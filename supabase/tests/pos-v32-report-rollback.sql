begin;
set local statement_timeout='30s';
create temporary table v32_report_samples(name text primary key,report jsonb) on commit drop;
create function pg_temp.report_fingerprint() returns jsonb language plpgsql as $$
declare names text[]:=array['public.laundry_pos_orders','public.laundry_pos_order_items','public.laundry_pos_payments',
 'public.laundry_pos_cash_ledger','public.laundry_pos_point_links','public.laundry_members','public.laundry_audit_events',
 'public.laundry_pos_cashier_audit','public.laundry_pos_order_events','public.laundry_pos_commands',
 'public.laundry_pos_cash_shifts','public.laundry_pos_guest_customers','public.laundry_pos_outlets','public.laundry_pos_staff',
 'public.laundry_pos_staff_outlets','laundry_private.pos_cash_reconciliations','laundry_private.pos_v31_cash_metadata',
 'laundry_private.pos_v31_cash_categories','laundry_private.pos_v3_payment_methods'];
 n text;hash_v text;result_v jsonb:='{}';
begin
 foreach n in array names loop
  execute format('select md5(coalesce(string_agg(j,chr(10) order by j),'''')) from (select to_jsonb(t)::text j from %s t)x',n) into hash_v;
  result_v:=result_v||jsonb_build_object(n,hash_v);
 end loop;return result_v;
end;$$;
do $test$
declare owner_v uuid:=gen_random_uuid();outlet_v uuid;guest_v uuid:=gen_random_uuid();order_v uuid:=gen_random_uuid();shift_v uuid:=gen_random_uuid();
 cmd_v uuid;pay_v uuid;receipt_v uuid;staff_v uuid;name_v text;device_v text:=repeat('J',43);login_v text:=repeat('K',43);
 r jsonb;r2 jsonb;before_v jsonb;invalid_before_v jsonb;i integer;at_v timestamptz;amount_v bigint;kind_v text;method_v text;
begin
 insert into auth.users(id,aud,role) values(owner_v,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_v,true);
 perform set_config('request.jwt.claim.sub',owner_v::text,true);
 update public.laundry_pos_outlets set active=true,write_enabled=true,finance_enabled=true,pilot_test_only=true;
 outlet_v:=laundry_private.pos_owner_outlet();
 insert into public.laundry_pos_guest_customers(id,outlet_id,display_name,created_by) values(guest_v,outlet_v,'UJI - V32 historical',owner_v);
 insert into public.laundry_pos_orders(id,outlet_id,sequence_number,invoice_no,guest_id,customer_name,lifecycle_status,
  service_subtotal_idr,total_idr,catalog_revision,created_by,created_at,is_test_order)
 values(order_v,outlet_v,987654321,'QA-V32-'||order_v,guest_v,'UJI - V32 historical','CONFIRMED',100000,100000,1,owner_v,'2026-10-30 23:59:00+07',true);
 insert into public.laundry_pos_order_items(order_id,line_number,service_name,unit,quantity_milli,price_idr,line_total_idr)
 values(order_v,1,'QA kg','kg',1250,80000,100000),(order_v,2,'QA meter','m',2350,0,0),(order_v,3,'QA pcs','pcs',3000,0,0);
 insert into public.laundry_pos_cash_shifts(id,outlet_id,register_code,opened_by,opened_at,opening_idr)
 values(shift_v,outlet_v,'MAIN',owner_v,'2026-10-01 00:00+07',1000);
 for i in 1..3 loop
  cmd_v:=gen_random_uuid();pay_v:=gen_random_uuid();
  at_v:=case i when 1 then '2026-10-30 23:59:00+07'::timestamptz when 2 then '2026-11-02 00:00:00+07'::timestamptz else '2026-11-05 12:00:00+07'::timestamptz end;
  amount_v:=case i when 1 then 30000 when 2 then 70000 else 30000 end;
  kind_v:=case when i=3 then 'REFUND' else 'RECEIPT' end;method_v:=case when i=2 then 'NONCASH' else 'CASH' end;
  insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,operation,payload_digest,result)
  values(cmd_v,outlet_v,owner_v,case when i=3 then 'FULL_REFUND' else 'PAYMENT' end,extensions.digest(cmd_v::text,'sha256'),'{}');
  insert into public.laundry_pos_payments(id,order_id,outlet_id,command_id,shift_id,entry_type,original_receipt_id,method,amount_idr,confirmed_by,confirmed_at)
  values(pay_v,order_v,outlet_v,cmd_v,shift_v,kind_v,case when i=3 then receipt_v end,method_v,amount_v,owner_v,at_v);
  if i=1 then receipt_v:=pay_v;end if;
  if i=2 then insert into laundry_private.pos_v3_payment_methods values(cmd_v,pay_v,'QRIS');end if;
  insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,payment_id,command_id,direction,method,amount_idr,category,created_by,occurred_at)
  values(outlet_v,shift_v,pay_v,cmd_v,case when i=3 then 'OUT' else 'IN' end,method_v,amount_v,case when i=3 then 'REFUND' else 'PAYMENT' end,owner_v,at_v);
 end loop;
 for i in 1..4 loop
  cmd_v:=gen_random_uuid();
  insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,operation,payload_digest,result)
  values(cmd_v,outlet_v,owner_v,'CASH_ENTRY',extensions.digest(cmd_v::text,'sha256'),'{}');
  insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,command_id,direction,method,amount_idr,category,note,created_by,occurred_at)
  values(outlet_v,shift_v,cmd_v,case when i=1 then 'IN' else 'OUT' end,'CASH',100,
   case when i=1 then 'NON_SALE_IN' else 'NON_SALE_OUT' end,'QA historical expense',owner_v,'2026-11-03 00:00+07');
  if i<4 then insert into laundry_private.pos_v31_cash_metadata values(cmd_v,case i when 1 then 'CAPITAL' when 2 then 'CASH_TRANSFER' else 'DETERGENT' end,'QA metadata');end if;
 end loop;
 insert into laundry_private.pos_cash_reconciliations values(gen_random_uuid(),owner_v,outlet_v,800,750,'QA observed later','2026-11-06 12:00+07',true);
 before_v:=pg_temp.report_fingerprint();
 r:=public.laundry_pos_v32_report('2026-10-01 00:00+07','2026-11-01 00:00+07');
 if r->>'schema_version'<>'32' or r->'summary'->>'order_total'<>'100000' or jsonb_array_length(r->'cash')<>1
  or r->'summary'->'quantities_milli'<>'{"kg":1250,"m":2350,"pcs":3000}'::jsonb then raise exception 'October bill/DP/units wrong: %',r;end if;
 insert into v32_report_samples values('october',r);
 r:=public.laundry_pos_v32_report('2026-11-01 00:00+07','2026-12-01 00:00+07');
 if r->'summary'->>'order_total'<>'0' or jsonb_array_length(r->'cash')<>6 or r->'orders'->0->>'created_in_period'<>'false'
  or r->'cash'->0->>'method'<>'QRIS' or r->'cash_reconciliation'->>'opening_cash'<>'31000'
  or r->'cash_reconciliation'->>'closing_cash'<>'800' then raise exception 'November historical cash wrong: %',r;end if;
 if r->'cash_reconciliation'->'physical_checks'->0->>'difference'<>'-50' or r->'completeness'->>'historical_receivables'<>'UNAVAILABLE' then raise exception 'observation/historical scope mislabeled';end if;
 insert into v32_report_samples values('november',r);
 if (select count(distinct e->>'accounting_classification') from jsonb_array_elements(r->'cash')e)<>6 then raise exception 'financial classifications conflated';end if;
 r2:=public.laundry_pos_v32_report('2026-11-02 00:00+07','2026-11-03 00:00+07');
 if jsonb_array_length(r2->'cash')<>1 or jsonb_array_length(r2->'orders')<>1 then raise exception 'WIB exclusive midnight boundary or payment/ledger reference wrong';end if;
 r2:=public.laundry_pos_v32_report('2026-10-01 00:00+07','2026-12-01 00:00+07');
 if jsonb_array_length(r2->'cash')<>7 or r2->'summary'->>'order_count'<>'1' then raise exception 'combined period duplicated';end if;
 insert into v32_report_samples values('combined',r2);
 r2:=public.laundry_pos_v32_report('2026-10-01 00:00+07','2026-10-02 00:00+07');
 if r2->'cash_reconciliation'->>'opening_cash'<>'0' or r2->'cash_reconciliation'->>'opening_seed_in_period'<>'1000'
  or r2->'cash_reconciliation'->>'closing_cash'<>'1000' then raise exception 'initial seed at exact interval start counted twice';end if;
 if pg_temp.report_fingerprint()<>before_v then raise exception 'export mutated transaction/member/audit/reconciliation sources';end if;
 -- An inconsistent legacy receipt or refund is a refusal, never a reassigned cash day.
 for i in 1..2 loop
  begin
   cmd_v:=gen_random_uuid();pay_v:=gen_random_uuid();
   insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,operation,payload_digest,result)
   values(cmd_v,outlet_v,owner_v,case when i=1 then 'PAYMENT' else 'FULL_REFUND' end,extensions.digest(cmd_v::text,'sha256'),'{}');
   insert into public.laundry_pos_payments(id,order_id,outlet_id,command_id,shift_id,entry_type,original_receipt_id,method,amount_idr,confirmed_by,confirmed_at)
   values(pay_v,order_v,outlet_v,cmd_v,shift_v,case when i=1 then 'RECEIPT' else 'REFUND' end,
    case when i=2 then receipt_v end,'CASH',1,owner_v,'2026-11-01 23:59:59.999999+07');
   insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,payment_id,command_id,direction,method,amount_idr,category,created_by,occurred_at)
   values(outlet_v,shift_v,pay_v,cmd_v,case when i=1 then 'IN' else 'OUT' end,'CASH',1,
    case when i=1 then 'PAYMENT' else 'REFUND' end,owner_v,'2026-11-02 00:00:00+07');
   perform public.laundry_pos_v32_report('2026-11-02 00:00+07','2026-11-03 00:00+07');
   raise exception 'inconsistent receipt/refund timestamps accepted';
  exception when invalid_parameter_value then if sqlerrm<>'POS_REPORT_INTEGRITY' then raise;end if;end;
 end loop;
 if pg_temp.report_fingerprint()<>before_v then raise exception 'integrity refusal changed sources';end if;
 -- Missing receipt and refund journal rows must fail for period flows and old opening balances.
 for i in 1..4 loop
  begin
   cmd_v:=gen_random_uuid();pay_v:=gen_random_uuid();
   insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,operation,payload_digest,result)
   values(cmd_v,outlet_v,owner_v,case when i%2=1 then 'PAYMENT' else 'FULL_REFUND' end,extensions.digest(cmd_v::text,'sha256'),'{}');
   insert into public.laundry_pos_payments(id,order_id,outlet_id,command_id,shift_id,entry_type,original_receipt_id,method,amount_idr,confirmed_by,confirmed_at)
   values(pay_v,order_v,outlet_v,cmd_v,shift_v,case when i%2=1 then 'RECEIPT' else 'REFUND' end,
    case when i%2=0 then receipt_v end,'CASH',1,owner_v,case when i<=2 then '2026-11-02 00:00+07'::timestamptz else '2026-10-31 00:00+07'::timestamptz end);
   invalid_before_v:=pg_temp.report_fingerprint();
   begin
    perform public.laundry_pos_v32_report('2026-11-01 00:00+07','2026-12-01 00:00+07');
    raise exception 'missing receipt/refund ledger row accepted';
   exception when invalid_parameter_value then if sqlerrm<>'POS_REPORT_INTEGRITY' then raise;end if;end;
   if pg_temp.report_fingerprint()<>invalid_before_v then raise exception 'missing ledger refusal mutated sources';end if;
   -- Roll back this intentionally invalid fixture before testing the next case.
   raise exception using errcode='ZX001',message='discard invalid missing-ledger fixture';
  exception when sqlstate 'ZX001' then null;end;
 end loop;
 if pg_temp.report_fingerprint()<>before_v then raise exception 'missing-ledger fixture escaped rollback';end if;
 staff_v:=public.laundry_pos_owner_save_cashier(null,'QA V32 report cashier','{"reports_view":true,"order_view":false}',true);
 select username into name_v from public.laundry_pos_staff where staff_id=staff_v;
 perform set_config('request.jwt.claim.sub','',true);
 if not public.laundry_pos_cashier_direct_id_login(name_v,device_v,login_v) then raise exception 'QA cashier login failed';end if;
 before_v:=pg_temp.report_fingerprint();
 r:=public.laundry_pos_v32_report('2026-10-01 00:00+07','2026-12-01 00:00+07',device_v,login_v);
 if r->>'can_view_orders'<>'false' or r->'orders'<>'[]' or r->'items'<>'[]' or r->'summary'->>'order_total'<>'100000'
  or r->'cash_reconciliation'->>'status'<>'OWNER_ONLY' or exists(select 1 from jsonb_array_elements(r->'cash')e where
   e->>'order_id' is not null or e->>'customer' is not null or e->>'invoice' is not null or e->>'payment_id' is not null) then raise exception 'restricted report leaked order data';end if;
 if pg_temp.report_fingerprint()<>before_v then raise exception 'cashier export mutated sources';end if;
 update public.laundry_pos_staff_outlets set permissions=permissions||'{"order_view":true}' where staff_id=staff_v;
 r:=public.laundry_pos_v32_report('2026-10-01 00:00+07','2026-12-01 00:00+07',device_v,login_v);
 if jsonb_array_length(r->'orders')<>1 or jsonb_array_length(r->'items')<>3 then raise exception 'authorized detail unavailable';end if;
 update public.laundry_pos_staff_outlets set permissions=permissions||'{"reports_view":false}' where staff_id=staff_v;
 begin perform public.laundry_pos_v32_report('2026-11-01','2026-11-02',device_v,login_v);raise exception 'revoked grant accepted';exception when insufficient_privilege then null;end;
 update public.laundry_pos_staff_outlets set permissions=permissions||'{"reports_view":true}' where staff_id=staff_v;
 update public.laundry_pos_cashier_logins set revoked_at=clock_timestamp() where staff_id=staff_v;
 begin perform public.laundry_pos_v32_report('2026-11-01','2026-11-02',device_v,login_v);raise exception 'revoked login accepted';exception when insufficient_privilege then null;end;
 begin perform public.laundry_pos_v32_report('2026-11-01','2026-11-02');raise exception 'anonymous report accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_v::text,true);
 r:=public.laundry_pos_v32_report('2025-01-01 00:00+07','2025-04-04 00:00+07');
 if jsonb_array_length(r->'cash')<>0 or jsonb_array_length(r->'orders')<>0 or r->'summary'->>'order_count'<>'0'
  or r->'cash_reconciliation'->>'opening_cash'<>'0' or r->'cash_reconciliation'->>'closing_cash'<>'0' then raise exception 'empty 93-day report fabricated financial activity';end if;
 begin perform public.laundry_pos_v32_report('2026-01-01','2026-04-05');raise exception '94 day range accepted';exception when invalid_parameter_value then null;end;
 begin perform public.laundry_pos_v32_report('2026-11-02','2026-11-01');raise exception 'inverted range accepted';exception when invalid_parameter_value then null;end;
 insert into public.laundry_pos_orders(outlet_id,sequence_number,invoice_no,guest_id,customer_name,lifecycle_status,
  service_subtotal_idr,total_idr,catalog_revision,created_by,created_at,is_test_order)
 select outlet_v,987654321+seq.value,'QA-V32-limit-'||order_v||'-'||seq.value,guest_v,'UJI - V32 limit','CONFIRMED',0,0,1,owner_v,'2025-05-01 00:00+07',true
 from generate_series(1,1001)seq(value);
 begin perform public.laundry_pos_v32_report('2025-05-01 00:00+07','2025-05-02 00:00+07');raise exception 'oversized report silently truncated';exception when invalid_parameter_value then
  if sqlerrm<>'POS_REPORT_LIMIT' then raise;end if;end;
 if (select provolatile from pg_proc where oid='public.laundry_pos_v32_report(timestamptz,timestamptz,text,text)'::regprocedure)<>'s' then raise exception 'snapshot function is not STABLE';end if;
 raise notice 'V32 rollback-only cross-month, boundaries, classifications, permissions and source fingerprints PASS';
end;$test$;
select jsonb_object_agg(name,report) as samples from v32_report_samples;
rollback;
