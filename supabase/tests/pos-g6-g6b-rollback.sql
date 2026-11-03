-- Stage10 + isolated QA regression; ALL fixtures roll back.
begin;
set local statement_timeout='35s';
do $g6$
declare
 v_owner uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';v_staff uuid;v_member uuid:=gen_random_uuid();
 v_device text:=repeat('K',43);v_login text:=repeat('L',43);
 v_outlet uuid; v_service uuid:=gen_random_uuid(); v_order uuid; v_resp jsonb;v_overview jsonb;
 v_report jsonb; v_batch jsonb;v_batch2 jsonb;v_row uuid; v_retry jsonb;
 v_close uuid:=gen_random_uuid();v_entry uuid:=gen_random_uuid();v_shift uuid:=gen_random_uuid();
 v_cash_close jsonb; v_count bigint;
begin
 select id into strict v_outlet from public.laundry_pos_outlets where code='MJL' and not write_enabled;
 if has_table_privilege('anon','public.laundry_pos_import_rows','select') or
    has_table_privilege('authenticated','public.laundry_pos_cash_ledger','insert') then
    raise exception 'G6 raw table privilege leak';end if;
 insert into auth.users(id,aud,role) values(v_owner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(v_owner,true);
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 v_staff:=public.laundry_pos_owner_save_cashier(null,'Kasir G6 Synthetic',
   '{"order_view":true,"order_create":true,"member_lookup":true,"payment_collect":true,"cash_view":true,"cash_entry":true,"reports_view":true}'::jsonb,true);
 perform public.laundry_pos_owner_pair_cashier(v_staff,v_device);
 if not public.laundry_pos_cashier_login(v_device,'MAS-0001',v_login) then
  raise exception 'G6 login failed';end if;
 insert into public.laundry_members(id,member_number,display_name,created_by) overriding system value
 values(v_member,876543210,'Uji Pelanggan G6',v_owner);
 perform set_config('request.jwt.claim.sub','',true);
 -- Staff cannot call owner-only import.
 begin
  perform public.laundry_pos_g6b_import_batches();
  raise exception 'G6b guest/cashier could see imports';
 exception when sqlstate '42501' then null;end;
 begin
  perform public.laundry_pos_g6_cash_entry(v_device,v_login,v_entry,'IN','5000','Uang kasir awal');
  raise exception 'G6 entry allowed while write disabled';
 exception when sqlstate '42501' then null;end;
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true where id=v_outlet;
 insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration)
 values(v_service,'Kiloan','','Cuci G6',25000,'kg','Reguler');
 v_resp:=public.laundry_pos_g4_create_order(v_device,v_login,gen_random_uuid(),'Tamu G6',null,
  jsonb_build_array(jsonb_build_object('service_id',v_service,'quantity','1','revision',1)),null,null);
 v_order:=(v_resp->>'order_id')::uuid;
 v_resp:=public.laundry_pos_g5_open_shift(v_device,v_login,v_shift);
 if v_resp->>'status'<>'OPEN' then raise exception 'G6 shift not open';end if;
 v_resp:=public.laundry_pos_g5_payment(v_device,v_login,gen_random_uuid(),v_order,'25000','CASH',1);
 if v_resp->>'payment_status'<>'PAID' then raise exception 'G6 payment failed';end if;
 v_resp:=public.laundry_pos_g6_cash_entry(v_device,v_login,v_entry,'IN','5000','Uang kasir awal');
 if v_resp->>'status'<>'POSTED' then raise exception 'G6 cash entry missing';end if;
 v_retry:=public.laundry_pos_g6_cash_entry(v_device,v_login,v_entry,'IN','5000','Uang kasir awal');
 if v_retry<>v_resp then raise exception 'G6 idempotency changed';end if;
 begin
  perform public.laundry_pos_g6_cash_entry(v_device,v_login,v_entry,'OUT','5000','Uang kasir awal');
  raise exception 'G6 conflicting UUID accepted';
 exception when unique_violation then null;end;
 perform public.laundry_pos_g6_cash_entry(v_device,v_login,gen_random_uuid(),'OUT','1000','Beli kebutuhan kasir');
 v_overview:=public.laundry_pos_g6_cash_overview(v_device,v_login);
 if v_overview->>'expected_cash_idr'<>'29000' or v_overview->>'cash_in_idr'<>'30000'
   or v_overview->>'cash_out_idr'<>'1000' then
   raise exception 'G6 expected CASH balance mismatch %',v_overview;end if;
 begin
  perform public.laundry_pos_g6_close_shift(v_device,v_login,gen_random_uuid(),'28000','');
  raise exception 'G6 close without discrepancy reason accepted';
 exception when sqlstate '22023' then null;end;
 v_cash_close:=public.laundry_pos_g6_close_shift(v_device,v_login,v_close,'29000','');
 if v_cash_close->>'status'<>'CLOSED' or v_cash_close->>'discrepancy_idr'<>'0' then
  raise exception 'G6 closing receipt bad %',v_cash_close;end if;
 if public.laundry_pos_g6_close_shift(v_device,v_login,v_close,'29000','')<>v_cash_close then
  raise exception 'G6 close replay failed';end if;
 begin
  perform public.laundry_pos_g6_cash_entry(v_device,v_login,gen_random_uuid(),'IN','1000','After close');
  raise exception 'G6 accepted post into closed shift';
 exception when sqlstate '22023' then null;end;
 v_report:=public.laundry_pos_g6_report(v_device,v_login,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day');
 if v_report->>'cash_in_idr'<>'30000' or v_report->>'cash_out_idr'<>'1000' or
   (v_report->>'orders_created')::int<>1 or (v_report->>'receivables_as_of_end_idr')<>'0' then
   raise exception 'G6 report wrong %',v_report;end if;
 if (v_report->>'truncated')::boolean then raise exception 'G6 report truncated fixtures';end if;
 -- Opening a new shift is still G5, but it must use a distinct command UUID.
 v_resp:=public.laundry_pos_g5_open_shift(v_device,v_login,gen_random_uuid());
 if v_resp->>'status'<>'OPEN' then raise exception 'G6 reopen shift unavailable';end if;
 -- G6b: only owner can preview and review historical Binatu rows.
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 v_batch:=public.laundry_pos_g6b_import_preview('BINATU',repeat('a',64),jsonb_build_array(
  jsonb_build_object('row','10','invoice','BIN-001','customer','Uji Pelanggan G6',
   'payment','PAID','status','SIAP_AMBIL','total','50000','paid','50000'),
  jsonb_build_object('row','11','invoice','BIN-002','customer','Tamu Lain',
   'payment','UNPAID','status','ANTRIAN','total','70000','paid','0')));
 if v_batch->>'duplicate_file'<>'false' or v_batch->>'rows'<>'2' then
  raise exception 'G6b batch insert failed %',v_batch;end if;
 v_retry:=public.laundry_pos_g6b_import_preview('BINATU',repeat('a',64),
  jsonb_build_array(jsonb_build_object('row','10','invoice','IGNORED','customer','Ignore Name',
   'payment','PAID','status','ANTRIAN','total','100','paid','100')));
 if v_retry->>'duplicate_file'<>'true' or v_retry->>'batch_id'<>v_batch->>'batch_id' then
  raise exception 'G6b duplicate import did not return canonical batch';end if;
 select id into strict v_row from public.laundry_pos_import_rows where batch_id=(v_batch->>'batch_id')::uuid and external_invoice='BIN-001';
 if jsonb_array_length(public.laundry_pos_g6b_member_candidates(v_row))<>1 then
  raise exception 'G6b member candidate mismatch';end if;
 v_retry:=public.laundry_pos_g6b_review_row(v_row,v_member,'MATCHED','');
 if v_retry->>'points_awarded'<>'0' or v_retry->>'financial_posted'<>'false' then
  raise exception 'G6b import posted money/points';end if;
 begin
  perform public.laundry_pos_g6b_review_row(v_row,null,'SKIPPED','change of mind');
  raise exception 'G6b double review mutation accepted';
 exception when unique_violation then null;end;
 v_batch2:=public.laundry_pos_g6b_import_preview('BINATU',repeat('b',64),jsonb_build_array(
  jsonb_build_object('row','10','invoice','BIN-001','customer','Uji Pelanggan G6',
   'payment','PAID','status','SIAP_AMBIL','total','50000','paid','50000')));
 if not exists(select 1 from public.laundry_pos_import_rows where batch_id=(v_batch2->>'batch_id')::uuid
   and review_status='CONFLICT') then raise exception 'G6b duplicate source invoice not flagged';end if;
 if (select count(*) from public.laundry_pos_point_links)>0 or
    (select count(*) from public.laundry_amount_transactions)>0 then
  raise exception 'G6b import generated points / finance';end if;
 select count(*) into v_count from public.laundry_pos_payments;
 if v_count<>1 then raise exception 'G6b import posted receipts';end if;
end;
$g6$;
rollback;