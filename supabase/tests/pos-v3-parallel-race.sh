#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "laundry_qa_ci" ]]; then
 echo 'REFUSED: V3 race requires ephemeral CI database' >&2; exit 2
fi
owner='b3339000-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
family='b3339000-bbbb-4bbb-8bbb-bbbbbbbb9001'
request='b3339000-bbbb-4bbb-8bbb-bbbbbbbb9002'
psql -Xq -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into auth.users(id,aud,role) values('$owner','authenticated','authenticated');
insert into public.laundry_owner_accounts(auth_user_id,is_active) values('$owner',true);
select set_config('request.jwt.claim.sub','$owner',false);
update public.laundry_pos_outlets set active=true,write_enabled=true,finance_enabled=true,pilot_test_only=true;
select public.laundry_pos_owner_close_shift(gen_random_uuid(),'0','QA V3 race isolation') where exists(select 1 from public.laundry_pos_cash_shifts where closed_at is null);
select public.laundry_pos_save_family('$family',0,'{"name":"V3 race","category":"QA","unit":"kg","position":99,"active":true}',
'[{"code":"REGULAR","price_idr":"6000","active":true},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
select public.laundry_pos_owner_create_order(gen_random_uuid(),'UJI - V3 race',null,
jsonb_build_array(jsonb_build_object('service_id',(select id from public.laundry_services where family_id='$family' and duration_package_code='REGULAR'),'revision',1,'quantity','1')),null,null);
SQL
order_id=$(psql -XAt -v ON_ERROR_STOP=1 -c "select id from public.laundry_pos_orders where customer_name='UJI - V3 race'")
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
worker(){
 psql -XqAt -v ON_ERROR_STOP=1 >"$tmp/$1.out" 2>"$tmp/$1.err" <<SQL
begin;
select set_config('request.jwt.claim.sub','$owner',true);
select pg_sleep(0.2);
select public.laundry_pos_v3_finance('PAYMENT','$request','$order_id','6000','TRANSFER',1);
select pg_sleep(0.3);
commit;
SQL
}
worker a & a=$!
worker b & b=$!
wait "$a"; wait "$b"
[[ "$(grep 'payment_id' "$tmp/a.out")" == "$(grep 'payment_id' "$tmp/b.out")" ]]
psql -Xq -v ON_ERROR_STOP=1 >/dev/null <<SQL
do \$\$begin
 if (select count(*) from public.laundry_pos_payments where order_id='$order_id')<>1
 or (select count(*) from public.laundry_pos_cash_ledger where command_id='$request')<>1
 or (select count(*) from public.laundry_pos_cash_shifts where closed_at is null)<>1
 or (select count(*) from laundry_private.pos_v3_payment_methods where request_id='$request' and method='TRANSFER')<>1
 then raise exception 'V3 automatic cash/payment race duplicated';end if;
end\$\$;
SQL
echo 'PASS: V3 concurrent retry opens one technical cash session and posts one transfer'
