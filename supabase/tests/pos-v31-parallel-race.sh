#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "laundry_qa_ci" ]]; then
 echo 'REFUSED: V31 races require ephemeral CI database' >&2; exit 2
fi
owner='b3319000-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
family='b3319000-bbbb-4bbb-8bbb-bbbbbbbb9001'
request='b3319000-bbbb-4bbb-8bbb-bbbbbbbb9002'
cash_request='b3319000-bbbb-4bbb-8bbb-bbbbbbbb9003'
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
psql -Xq -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into auth.users(id,aud,role) values('$owner','authenticated','authenticated');
insert into public.laundry_owner_accounts(auth_user_id,is_active) values('$owner',true);
select set_config('request.jwt.claim.sub','$owner',false);
update public.laundry_pos_outlets set active=true,write_enabled=true,finance_enabled=true,pilot_test_only=true,package_workflow_enabled=true;
select public.laundry_pos_save_package('REGULAR',(select revision from public.laundry_pos_duration_packages where code='REGULAR'),'Reguler',4320,true);
select public.laundry_pos_save_family('$family',0,'{"name":"V31 contact race","category":"QA","unit":"kg","position":99,"active":true}',
'[{"code":"REGULAR","price_idr":"6000","active":true},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
SQL
worker(){
 local phase="$1" index="$2"
 psql -XqAt -v ON_ERROR_STOP=1 >"$tmp/$phase-$index.out" 2>"$tmp/$phase-$index.err" <<SQL
begin;
select set_config('request.jwt.claim.sub','$owner',true);
select pg_sleep(0.2);
$(if [[ "$phase" == 'contact' ]]; then
 printf "select public.laundry_pos_v31_create_order('%s','UJI - V31 contact race',null,jsonb_build_array(jsonb_build_object('service_id',(select id from public.laundry_services where family_id='%s' and duration_package_code='REGULAR'),'revision',1,'quantity','0.75')),null,null,'NONE',(select revision from laundry_private.pos_delivery_options where code='NONE'),'+628111111111','Alamat penguji');" "$request" "$family"
else
 printf "select public.laundry_pos_v31_cash_entry('%s','OUT','10','PACKAGING','QA exact retry');" "$cash_request"
fi)
select pg_sleep(0.3);
commit;
SQL
}
for phase in contact cash; do
 worker "$phase" a & a=$!
 worker "$phase" b & b=$!
 if ! wait "$a"; then cat "$tmp/$phase-a.err" >&2; exit 1;fi
 if ! wait "$b"; then cat "$tmp/$phase-b.err" >&2; exit 1;fi
 if [[ "$phase" == contact ]]; then pattern='order_id';else pattern='POSTED';fi
 [[ "$(grep "$pattern" "$tmp/$phase-a.out")" == "$(grep "$pattern" "$tmp/$phase-b.out")" ]]
done
psql -Xq -v ON_ERROR_STOP=1 >/dev/null <<SQL
do \$\$begin
 if (select count(*) from public.laundry_pos_orders where customer_name='UJI - V31 contact race')<>1
 or (select count(*) from laundry_private.pos_order_contact_drafts where request_id='$request')<>1
 or (select count(*) from public.laundry_pos_cash_ledger where command_id='$cash_request')<>1
 or (select count(*) from laundry_private.pos_v31_cash_metadata where request_id='$cash_request' and category_code='PACKAGING')<>1
 then raise exception 'V31 concurrent retry duplicated contact/order/cash metadata';end if;
end\$\$;
SQL
echo 'PASS: V31 two-connection retries create one order/contact and one categorized cash entry'
