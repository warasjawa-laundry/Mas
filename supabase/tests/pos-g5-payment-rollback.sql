-- G5 synthetic QA regression. No lasting data; execute only after G5 migration.
-- Stage 10 runs it once on isolated PostgreSQL 17 and Supabase QA dry-run.
begin;
set local statement_timeout='25s';
do $g5$
declare
 v_owner uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 device text:=repeat('D',43); login text:=repeat('E',43);
 v_staff uuid; v_outlet uuid; v_service uuid:=gen_random_uuid();
 v_member uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); v_order uuid;
 result jsonb; partial_result jsonb; finish_result jsonb; refund_result jsonb;
 partial_req uuid:=gen_random_uuid(); finish_req uuid:=gen_random_uuid(); refund_req uuid:=gen_random_uuid();
 shift_req uuid:=gen_random_uuid(); new_req uuid:=gen_random_uuid();
 order_version bigint; guest_order uuid; free_service uuid:=gen_random_uuid();
 other_staff uuid; other_device text:=repeat('X',43); other_login text:=repeat('Y',43);
begin
 select id into strict v_outlet from public.laundry_pos_outlets where code='MJL' and not write_enabled;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname like 'laundry_pos_%' and c.relkind='r' and c.relrowsecurity)<>20 then
 raise exception 'G5 RLS protection count mismatch';end if;
 if has_table_privilege('anon','public.laundry_pos_payments','insert')
 or has_table_privilege('authenticated','public.laundry_pos_point_links','insert') then
 raise exception 'G5 raw financial access exposed';end if;
 if has_function_privilege('anon','laundry_private.pos_g5_payment(text,text,uuid,uuid,text,text,bigint)','execute') is false then
  -- Mirrors G4 pattern: only scoped private helper may be granted EXECUTE.
  raise exception 'G5 helper missing';
 end if;
 insert into auth.users(id,aud,role) values(v_owner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(v_owner,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 v_staff:=public.laundry_pos_owner_save_cashier(null,'Kasir G5 QA',
  '{"order_view":true,"order_create":true,"order_work":true,"member_lookup":true,"payment_collect":true,"refund_full":true}'::jsonb,true);
 perform public.laundry_pos_owner_pair_cashier(v_staff,device);
 if not public.laundry_pos_cashier_login(device,'MAS-0001',login) then
 raise exception 'G5 synthetic login not available';end if;
 insert into public.laundry_members(id,member_number,display_name,created_by) overriding system value
 values(v_member,987654321,'Member G5 Synthetic',v_owner);
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration)
 values(v_service,'Kiloan','','Laundry G5 QA',93000,'kg','Reguler');
 -- Creating an order is initially denied while outlet write flag is false.
 begin
 perform public.laundry_pos_g5_open_shift(device,login,shift_req);
 raise exception 'G5 opened shift while POS disabled';
 exception when sqlstate '42501' then null;end;
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true where id=v_outlet;
 result:=public.laundry_pos_g4_create_order(device,login,req,null,'987654321',
   jsonb_build_array(jsonb_build_object('service_id',v_service,'quantity','1','revision',1)),null,null);
 v_order:=(result->>'order_id')::uuid;
 select version into order_version from public.laundry_pos_orders where id=v_order;
 if order_version<>1 then raise exception 'G5 order version unexpectedly changed';end if;
 -- Direct payment without an open cash register must not post anything.
 begin
 perform public.laundry_pos_g5_payment(device,login,new_req,v_order,'30000','CASH',1);
 raise exception 'G5 accepted receipt with no open shift';
 exception when sqlstate '22023' then null;end;
 if (select count(*) from public.laundry_pos_payments)<>0 then raise exception 'G5 posted without shift';end if;
 result:=public.laundry_pos_g5_open_shift(device,login,shift_req);
 if result->>'status'<>'OPEN' or public.laundry_pos_g5_open_shift(device,login,shift_req)<>result then
 raise exception 'G5 shift idempotency failed';end if;
 -- First partial payment: only receipt and cash ledger, no points.
 partial_result:=public.laundry_pos_g5_payment(device,login,partial_req,v_order,'30000','CASH',1);
 if partial_result->>'payment_status'<>'PARTIAL' or partial_result->>'remaining_idr'<>'63000'
 or partial_result->>'points_awarded'<>'0' then raise exception 'G5 partial incorrect %',partial_result;end if;
 if (select count(*) from public.laundry_amount_transactions where member_id=v_member)<>0 then
 raise exception 'G5 premature point award';end if;
 -- Exact retry after later version must still return the same committed result.
 if public.laundry_pos_g5_payment(device,login,partial_req,v_order,'30000','CASH',1)<>partial_result then
 raise exception 'G5 partial replay failed';end if;
 begin
 perform public.laundry_pos_g5_payment(device,login,partial_req,v_order,'31000','CASH',1);
 raise exception 'G5 accepted conflicting UUID payload';
 exception when unique_violation then null;end;
 begin
 perform public.laundry_pos_g5_payment(device,login,gen_random_uuid(),v_order,'63000','CASH',1);
 raise exception 'G5 accepted stale order version';
 exception when sqlstate '22023' then null;end;
 begin
 perform public.laundry_pos_g5_payment(device,login,gen_random_uuid(),v_order,'70000','CASH',2);
 raise exception 'G5 accepted overpayment';
 exception when sqlstate '22023' then null;end;
 -- Exact final payment: one ADD and one amount snapshot on the year rule.
 finish_result:=public.laundry_pos_g5_payment(device,login,finish_req,v_order,'63000','NONCASH',2);
 if finish_result->>'payment_status'<>'PAID' or finish_result->>'remaining_idr'<>'0'
  or finish_result->>'points_awarded'<>'5' then raise exception 'G5 final incorrect %',finish_result;end if;
 if (select count(*) from public.laundry_pos_payments where order_id=v_order and entry_type='RECEIPT')<>2 then
 raise exception 'G5 receipt count wrong';end if;
 if (select count(*) from public.laundry_pos_point_links where order_id=v_order and link_type='ADD')<>1 then
 raise exception 'G5 duplicate/missing award link';end if;
 if (select count(*) from public.laundry_amount_transactions t
 where t.member_id=v_member and t.actor_id is null and t.actor_staff_id=v_staff
 and t.amount_idr=93000 and t.awarded_points=5)<>1 then
 raise exception 'G5 award provenance wrong';end if;
 if (select count(*) from public.laundry_pos_cash_ledger where category='PAYMENT')<>2 then
 raise exception 'G5 ledger does not match receipts';end if;
 if public.laundry_pos_g5_payment(device,login,finish_req,v_order,'63000','NONCASH',2)<>finish_result then
 raise exception 'G5 final replay failed';end if;
 if (public.laundry_pos_g5_financial(device,login,v_order)->>'payment_status')<>'PAID' then
 raise exception 'G5 payment projection incorrect';end if;
 begin
 perform public.laundry_pos_g5_payment(device,login,gen_random_uuid(),v_order,'1','CASH',3);
 raise exception 'G5 accepted extra paid receipt';
 exception when sqlstate '22023' then null;end;
 -- Once write cutover enabled, old owner +1/manual amount cannot double-credit.
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 begin
 perform public.laundry_record_visit(v_member,gen_random_uuid());
 raise exception 'legacy ADD still allowed during POS cutover';
 exception when sqlstate '42501' then null;end;
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 -- Full refund returns each source method and appends one VOID in original year.
 refund_result:=public.laundry_pos_g5_refund_full(device,login,refund_req,v_order,'Koreksi refund sintetik',3);
 if refund_result->>'refunded_idr'<>'93000' or refund_result->>'refund_count'<>'2'
 or refund_result->>'point_reversed'<>'true' then
 raise exception 'G5 full refund result wrong %',refund_result;end if;
 if (select count(*) from public.laundry_pos_payments where order_id=v_order and entry_type='REFUND')<>2 then
 raise exception 'G5 refund journal count';end if;
 if (select count(*) from public.laundry_pos_cash_ledger where category='REFUND')<>2 then
 raise exception 'G5 cash refund journal count';end if;
 if not exists(select 1 from public.laundry_pos_point_links where order_id=v_order and link_type='VOID') then
 raise exception 'G5 missing point reversal';end if;
 if (select count(*) from public.laundry_checklist_events x join public.laundry_pos_point_links p
 on p.event_id=x.id where p.order_id=v_order and p.link_type='VOID' and x.reverses_event_id is not null)<>1 then
 raise exception 'G5 invalid legacy VOID';end if;
 if public.laundry_pos_g5_refund_full(device,login,refund_req,v_order,'Koreksi refund sintetik',3)<>refund_result then
 raise exception 'G5 refund replay failed';end if;
 if (public.laundry_pos_g5_financial(device,login,v_order)->>'payment_status')<>'REFUNDED' then
 raise exception 'G5 refund status missing';end if;
 begin
 perform public.laundry_pos_g5_refund_full(device,login,gen_random_uuid(),v_order,'Refund ulang',4);
 raise exception 'G5 accepted second refund';
 exception when sqlstate '22023' then null;end;
 -- Guest payment creates no member reward, even when fully paid.
 result:=public.laundry_pos_g4_create_order(device,login,gen_random_uuid(),'Pelanggan G5',null,
   jsonb_build_array(jsonb_build_object('service_id',v_service,'quantity','1','revision',1)),null,null);
 guest_order:=(result->>'order_id')::uuid;
 perform public.laundry_pos_g5_payment(device,login,gen_random_uuid(),guest_order,'93000','CASH',1);
 if (select count(*) from public.laundry_pos_point_links where order_id=guest_order)<>0 then
 raise exception 'G5 awarded points to guest';end if;
 -- A zero-total order cannot be paid and must never generate a zero-value ADD.
 insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration)
 values(free_service,'QA','','Free sample',0,'pcs','Reguler');
 result:=public.laundry_pos_g4_create_order(device,login,gen_random_uuid(),'Tamu Gratis',null,
    jsonb_build_array(jsonb_build_object('service_id',free_service,'quantity','1','revision',1)),null,null);
 guest_order:=(result->>'order_id')::uuid;
 begin
 perform public.laundry_pos_g5_payment(device,login,gen_random_uuid(),guest_order,'1','CASH',1);
 raise exception 'G5 accepted payment for zero-total order';
 exception when sqlstate '22023' then null;end;
 -- Another cashier with only payment grant cannot perform full refunds.
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 other_staff:=public.laundry_pos_owner_save_cashier(null,'Kasir Tanpa Refund',
    '{"order_view":true,"payment_collect":true}'::jsonb,true);
 perform public.laundry_pos_owner_pair_cashier(other_staff,other_device);
 if not public.laundry_pos_cashier_login(other_device,'MAS-0002',other_login) then
 raise exception 'G5 second staff login failed';end if;
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 begin
 perform public.laundry_pos_g5_refund_full(other_device,other_login,gen_random_uuid(),guest_order,'Tidak punya izin',1);
 raise exception 'G5 cashier without refund permission got access';
 exception when sqlstate '42501' then null;end;
 -- Revoke cashiers and deny financial reads/writes under stale login.
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 perform public.laundry_pos_owner_revoke_cashier_devices(v_staff);
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 begin
 perform public.laundry_pos_g5_payment(device,login,gen_random_uuid(),v_order,'1','CASH',4);
 raise exception 'G5 revoked cashier still permitted';
 exception when sqlstate '42501' then null;end;
end;
$g5$;
rollback;