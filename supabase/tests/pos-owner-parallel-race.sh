#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "laundry_qa_ci" ]]; then
 echo 'REFUSED: owner race requires ephemeral CI PostgreSQL' >&2; exit 2
fi
owner='bbbb9000-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
service='bbbb9000-bbbb-4bbb-8bbb-bbbbbbbb9001'
request='bbbb9000-bbbb-4bbb-8bbb-bbbbbbbb9002'
psql -Xq -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into auth.users(id,aud,role) values('$owner','authenticated','authenticated');
insert into public.laundry_owner_accounts(auth_user_id,is_active) values('$owner',true);
insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration)
 values('$service','QA','Race','Owner race synthetic',6000,'kg','6 jam');
select set_config('request.jwt.claim.sub','$owner',false);
select public.laundry_pos_save_package('REGULAR',1,'Reguler QA',360,true);
select public.laundry_pos_save_family('bbbb9000-bbbb-4bbb-8bbb-bbbbbbbb9007',0,
 '{"name":"Owner race synthetic","category":"QA","unit":"kg","position":1,"active":true}',
 '[{"code":"REGULAR","price_idr":"6000","active":true,"existing_id":"$service","existing_revision":1},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
select public.laundry_pos_enable_package_workflow();
update public.laundry_pos_outlets set write_enabled=true,finance_enabled=false where code='MJL';
SQL
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
worker(){
 psql -XqAt -v ON_ERROR_STOP=1 >"$tmp/$1.out" 2>"$tmp/$1.err" <<SQL
begin;
select set_config('request.jwt.claim.sub','$owner',true);
select pg_sleep(0.2);
select public.laundry_pos_owner_create_order('$request','Owner race synthetic',null,
 jsonb_build_array(jsonb_build_object('service_id','$service','quantity','1.255','revision',2)),null,null);
select pg_sleep(0.5);
commit;
SQL
}
worker a & a=$!
worker b & b=$!
wait "$a"; wait "$b"
first=$(grep 'invoice_no' "$tmp/a.out")
second=$(grep 'invoice_no' "$tmp/b.out")
[[ -n "$first" && "$first" == "$second" ]] || { cat "$tmp/"*.err >&2; exit 1; }
psql -Xq -v ON_ERROR_STOP=1 >/dev/null <<SQL
do \$\$begin
 if (select count(*) from public.laundry_pos_orders where customer_name='Owner race synthetic')<>1
 or (select count(*) from public.laundry_pos_commands where request_id='$request')<>1
 or not exists(select 1 from public.laundry_pos_orders where customer_name='Owner race synthetic'
 and created_by='$owner' and created_staff_id is null and total_idr=7530 and due_at is not null and package_minutes_snapshot=360)
 then raise exception 'owner concurrent create duplicated or actor/amount/ETA lost';end if;
end\$\$;
update public.laundry_pos_outlets set finance_enabled=true;
SQL
echo 'PASS: concurrent owner same-UUID create yields one invoice, owner actor and exact total'

counted=$(psql -XAt -v ON_ERROR_STOP=1 -c "select set_config('request.jwt.claim.sub','$owner',false)" -c "select public.laundry_pos_owner_cash_overview()->>'expected_cash_idr'" | tail -1)
close_worker(){
 psql -XqAt -v ON_ERROR_STOP=1 >"$tmp/close-$1.out" 2>"$tmp/close-$1.err" <<SQL
begin;
select set_config('request.jwt.claim.sub','$owner',true);
select pg_sleep(0.2);
select public.laundry_pos_owner_close_shift('bbbb9000-bbbb-4bbb-8bbb-bbbbbbbb9003','$counted','');
select pg_sleep(0.4);
commit;
SQL
}
close_worker a & a=$!
close_worker b & b=$!
wait "$a"; wait "$b"
[[ "$(grep 'CLOSED' "$tmp/close-a.out")" == "$(grep 'CLOSED' "$tmp/close-b.out")" ]]
[[ "$(psql -XAt -v ON_ERROR_STOP=1 -c "select count(*) from public.laundry_pos_commands where request_id='bbbb9000-bbbb-4bbb-8bbb-bbbbbbbb9003'")" == 1 ]]
echo 'PASS: concurrent identical close-shift requests produce one close result'

psql -Xq -v ON_ERROR_STOP=1 >/dev/null <<SQL
select set_config('request.jwt.claim.sub','$owner',false);
select public.laundry_pos_owner_open_shift('bbbb9000-bbbb-4bbb-8bbb-bbbbbbbb9004');
SQL
order_id=$(psql -XAt -v ON_ERROR_STOP=1 -c "select id from public.laundry_pos_orders where customer_name='Owner race synthetic'")
payment_worker(){
 if psql -XqAt -v ON_ERROR_STOP=1 >"$tmp/payment.out" 2>"$tmp/payment.err" <<SQL
begin;
select set_config('request.jwt.claim.sub','$owner',true);
select pg_sleep(0.2);
select public.laundry_pos_owner_payment('bbbb9000-bbbb-4bbb-8bbb-bbbbbbbb9005','$order_id','7530','CASH',1);
select pg_sleep(0.4);
commit;
SQL
 then echo SUCCESS >"$tmp/payment.status"; else echo FAIL >"$tmp/payment.status"; fi
}
close_competitor(){
 psql -XqAt -v ON_ERROR_STOP=1 >"$tmp/close-payment.out" 2>"$tmp/close-payment.err" <<SQL
begin;
select set_config('request.jwt.claim.sub','$owner',true);
select pg_sleep(0.2);
select public.laundry_pos_owner_close_shift('bbbb9000-bbbb-4bbb-8bbb-bbbbbbbb9006','0','Concurrent synthetic cash count');
select pg_sleep(0.4);
commit;
SQL
}
payment_worker & a=$!
close_competitor & b=$!
wait "$a"; wait "$b"
if [[ "$(cat "$tmp/payment.status")" == FAIL ]]; then grep -q 'POS_SHIFT_NOT_OPEN' "$tmp/payment.err"; fi
psql -Xq -v ON_ERROR_STOP=1 >/dev/null <<SQL
do \$\$begin
 if exists(select 1 from public.laundry_pos_payments p join public.laundry_pos_cash_shifts s on s.id=p.shift_id
  where p.order_id='$order_id' and (s.closed_at is null or p.confirmed_at>s.closed_at))
 or (select count(*) from public.laundry_pos_payments where order_id='$order_id')>1
 then raise exception 'payment posted after shift close or duplicated';end if;
end\$\$;
update public.laundry_pos_outlets set write_enabled=false,finance_enabled=false;
SQL
echo 'PASS: payment-versus-close serializes; no receipt can land after shift close'
