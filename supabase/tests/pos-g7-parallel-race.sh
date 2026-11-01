#!/usr/bin/env bash
set -euo pipefail
# G7 two independent transactions, in CI-only local PostgreSQL 17.
if [[ "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "laundry_qa_ci" ]]; then
 echo "REFUSED: race test may run only on ephemeral CI PostgreSQL" >&2; exit 2
fi
owner="bbbb7000-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
device="PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP"
login="QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ"
psql -X -q -A -t -v ON_ERROR_STOP=1 >/dev/null <<SQL
insert into auth.users(id,aud,role) values('$owner','authenticated','authenticated');
insert into public.laundry_owner_accounts(auth_user_id,is_active) values('$owner',true);
select set_config('request.jwt.claim.sub','$owner',false);
select public.laundry_pos_owner_save_cashier(null,'G7 Race Cashier',
 '{"order_view":true,"order_create":true,"member_lookup":true,"payment_collect":true,"cash_view":true,"cash_entry":true}'::jsonb,true);
select public.laundry_pos_owner_pair_cashier((select staff_id from public.laundry_pos_staff where username='MAS-0001'),'$device');
select public.laundry_pos_cashier_login('$device','MAS-0001','$login');
insert into public.laundry_members(member_number,display_name,created_by) overriding system value
 values(777777701,'G7 Member Race','$owner');
select set_config('request.jwt.claim.sub','',false);
insert into public.laundry_services(category,package_name,name,price_idr,unit,duration)
 values('Kiloan','','G7 Race Service',93000,'kg','Reguler');
update public.laundry_pos_outlets set write_enabled=true where code='MJL';
select public.laundry_pos_g4_create_order('$device','$login',gen_random_uuid(),null,'777777701',
 jsonb_build_array(jsonb_build_object('service_id',(select id from public.laundry_services where name='G7 Race Service'),'quantity','1','revision',1)),null,null);
select public.laundry_pos_g4_create_order('$device','$login',gen_random_uuid(),'G7 Guest Race',null,
 jsonb_build_array(jsonb_build_object('service_id',(select id from public.laundry_services where name='G7 Race Service'),'quantity','1','revision',1)),null,null);
select public.laundry_pos_g5_open_shift('$device','$login',gen_random_uuid());
SQL
member=$(psql -XAt -v ON_ERROR_STOP=1 -c "select id from public.laundry_pos_orders where customer_name='G7 Member Race'")
guest=$(psql -XAt -v ON_ERROR_STOP=1 -c "select id from public.laundry_pos_orders where customer_name='G7 Guest Race'")
if [[ ! "$member" =~ ^[a-f0-9-]{36}$ || ! "$guest" =~ ^[a-f0-9-]{36}$ ]]; then
 echo "FAIL: synthetic race orders missing" >&2; exit 1
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
same(){
 local worker="$1"
 psql -X -qAt -v ON_ERROR_STOP=1 >"$tmp/same-$worker.out" 2>"$tmp/same-$worker.err" <<SQL
begin;
select pg_sleep(0.2);
select public.laundry_pos_g5_payment('$device','$login','bbbb7000-bbbb-4bbb-8bbb-bbbbbbb70001','$member','93000','CASH',1);
select pg_sleep(0.8);
commit;
SQL
}
same a & a=$!
same b & b=$!
wait "$a"; wait "$b"
first=$(grep 'payment_id' "$tmp/same-a.out" | head -1)
second=$(grep 'payment_id' "$tmp/same-b.out" | head -1)
if [[ -z "$first" || "$first" != "$second" ]]; then
 echo "FAIL: same-key race returned different results" >&2
 cat "$tmp"/same-*.err >&2;exit 1
fi
if [[ "$(psql -XAt -v ON_ERROR_STOP=1 -c "select count(*) from public.laundry_pos_payments where order_id='$member' and entry_type='RECEIPT'")" != 1 ||
      "$(psql -XAt -v ON_ERROR_STOP=1 -c "select count(*) from public.laundry_pos_point_links where order_id='$member' and link_type='ADD'")" != 1 ]]; then
 echo "FAIL: duplicate receipt or member award" >&2;exit 1
fi
echo "PASS: same UUID from two DB connections yields one receipt and one award"
compete(){
 local worker="$1"
 local request="$2"
 if psql -X -qAt -v ON_ERROR_STOP=1 >"$tmp/compete-$worker.out" 2>"$tmp/compete-$worker.err" <<SQL
begin;
select pg_sleep(0.2);
select public.laundry_pos_g5_payment('$device','$login','$request','$guest','93000','CASH',1);
select pg_sleep(0.8);
commit;
SQL
 then echo SUCCESS >"$tmp/compete-$worker.status"
 else echo FAIL >"$tmp/compete-$worker.status"; fi
}
compete a "bbbb7000-bbbb-4bbb-8bbb-bbbbbbb70002" & a=$!
compete b "bbbb7000-bbbb-4bbb-8bbb-bbbbbbb70003" & b=$!
wait "$a";wait "$b"
winners=$(grep -l '^SUCCESS$' "$tmp"/compete-*.status |wc -l|tr -d ' ')
if [[ "$winners" != 1 ]] || ! grep -q 'POS_ORDER_VERSION_CONFLICT' "$tmp"/compete-*.err; then
 echo "FAIL: two distinct requests did not serialize" >&2
 cat "$tmp"/compete-*.err >&2;exit 1
fi
if [[ "$(psql -XAt -v ON_ERROR_STOP=1 -c "select count(*) from public.laundry_pos_payments where order_id='$guest' and entry_type='RECEIPT'")" != 1 ]];then
 echo "FAIL: guest double paid" >&2;exit 1
fi
echo "PASS: distinct UUIDs cannot double-collect a single balance"
