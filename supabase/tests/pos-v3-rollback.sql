begin;
set local statement_timeout='30s';
do $test$
declare owner_v uuid:=gen_random_uuid();s1 uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();s3 uuid:=gen_random_uuid();
 order_v uuid;partial_v uuid:=gen_random_uuid();result_v jsonb;again_v jsonb;report_v jsonb;cash_v jsonb;
 staff_v uuid;name_v text;cutoff_v timestamptz;device_v text:=repeat('7',43);login_v text:=repeat('8',43);recon_v uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role) values(owner_v,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_v,true);
 perform set_config('request.jwt.claim.sub',owner_v::text,true);
 update public.laundry_pos_outlets set active=true,write_enabled=true,finance_enabled=true,pilot_test_only=true,package_workflow_enabled=true;
 perform public.laundry_pos_save_package('REGULAR',(select revision from public.laundry_pos_duration_packages where code='REGULAR'),'Reguler',4320,true);
 perform public.laundry_pos_save_family(s1,0,'{"name":"QA kg","category":"QA V3","unit":"kg","position":1,"active":true}',
  '[{"code":"REGULAR","price_idr":"6000","active":true},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
 perform public.laundry_pos_save_family(s2,0,'{"name":"QA meter","category":"QA V3","unit":"meter","position":2,"active":true}',
  '[{"code":"REGULAR","price_idr":"8000","active":true},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
 perform public.laundry_pos_save_family(s3,0,'{"name":"QA pcs","category":"QA V3","unit":"pcs","position":3,"active":true}',
  '[{"code":"REGULAR","price_idr":"15000","active":true},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
 select id into s1 from public.laundry_services where family_id=s1 and duration_package_code='REGULAR';
 select id into s2 from public.laundry_services where family_id=s2 and duration_package_code='REGULAR';
 select id into s3 from public.laundry_services where family_id=s3 and duration_package_code='REGULAR';
 order_v:=(public.laundry_pos_owner_create_order(gen_random_uuid(),'UJI - V3 mixed',null,
  jsonb_build_array(jsonb_build_object('service_id',s1,'quantity','1.25','revision',1),jsonb_build_object('service_id',s2,'quantity','2.35','revision',1),jsonb_build_object('service_id',s3,'quantity','3','revision',1)),null,null)->>'order_id')::uuid;
 if exists(select 1 from public.laundry_pos_cash_shifts where closed_at is null) then raise exception 'fixture expects no open shift';end if;
 result_v:=public.laundry_pos_v3_finance('PAYMENT',partial_v,order_v,'25000','CASH',1);
 again_v:=public.laundry_pos_v3_finance('PAYMENT',partial_v,order_v,'25000','CASH',1);
 if again_v<>result_v or result_v->>'payment_status'<>'PARTIAL' then raise exception 'partial retry failed';end if;
 if (select count(*) from public.laundry_pos_cash_shifts where closed_at is null)<>1 then raise exception 'automatic shift duplicated';end if;
 cutoff_v:=clock_timestamp();
 staff_v:=public.laundry_pos_owner_save_cashier(null,'QA V3 cashier','{"order_view":true,"payment_collect":true,"cash_view":true,"reports_view":true}',true);
 select username into name_v from public.laundry_pos_staff where staff_id=staff_v;
 perform set_config('request.jwt.claim.sub','',true);
 if not public.laundry_pos_cashier_direct_id_login(name_v,device_v,login_v) then raise exception 'cashier login failed';end if;
 begin perform public.laundry_pos_v3_finance('PAYMENT',partial_v,order_v,'25000','CASH',1,null,null,device_v,login_v);raise exception 'cross actor retry allowed';exception when unique_violation then null;end;
 perform public.laundry_pos_v3_finance('PAYMENT',gen_random_uuid(),order_v,'46300','QRIS',2,null,null,device_v,login_v);
 report_v:=public.laundry_pos_v3_report(cutoff_v,clock_timestamp()+interval '1 hour',device_v,login_v);
 if jsonb_array_length(report_v->'cash')<>1 or report_v->'cash'->0->>'amount'<>'46300' or report_v->'orders'->0->>'created_in_period'<>'false' then raise exception 'prior period DP counted twice';end if;
 begin perform public.laundry_pos_print_receipt(order_v,device_v,login_v);raise exception 'missing print grant accepted';exception when insufficient_privilege then null;end;
 update public.laundry_pos_staff_outlets set permissions=permissions||'{"receipt_print":true}' where staff_id=staff_v;
 perform public.laundry_pos_print_receipt(order_v,device_v,login_v);
 perform set_config('request.jwt.claim.sub',owner_v::text,true);
 report_v:=public.laundry_pos_v3_report(clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour');
 if jsonb_array_length(report_v->'items')<>3 or jsonb_array_length(report_v->'cash')<>2 or report_v->'orders'->0->>'total'<>'71300'
  or report_v->'orders'->0->>'remaining'<>'0' then raise exception 'report multiplies items/payment: %',report_v;end if;
 if report_v->'cash'->1->>'method'<>'QRIS' then raise exception 'payment channel lost';end if;
 if (public.laundry_pos_print_receipt(order_v))->>'invoice' is distinct from (public.laundry_pos_whatsapp_receipt(order_v,'NEW'))->>'invoice' then raise exception 'receipt sources differ';end if;
 cash_v:=public.laundry_pos_v3_cash();
 if cash_v->'entries'->0->>'order_id'<>order_v::text or cash_v->'entries'->0->>'actor'<>'QA V3 cashier' then raise exception 'cash reference/actor missing';end if;
 perform public.laundry_pos_v3_reconcile(recon_v,25000,25000,'QA counted cash');
 perform public.laundry_pos_v3_reconcile(recon_v,25000,25000,'QA counted cash');
 cash_v:=public.laundry_pos_v3_cash();
 if jsonb_array_length(cash_v->'reconciliations')<>1 or cash_v->'reconciliations'->0->>'difference'<>'0' or cash_v->'reconciliations'->0->>'is_test'<>'true' then raise exception 'reconciliation history missing/duplicated/test marker lost';end if;
 cash_v:=public.laundry_pos_v3_cash(device_v,login_v);
 if jsonb_array_length(cash_v->'reconciliations')<>0 then raise exception 'cashier sees owner reconciliation';end if;
 perform public.laundry_pos_v3_finance('FULL_REFUND',gen_random_uuid(),order_v,null,null,3,'QA full refund');
 report_v:=public.laundry_pos_v3_report(clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour');
 if report_v->'orders'->0->>'status'<>'REFUNDED' or report_v->'orders'->0->>'remaining'<>'0' then raise exception 'refund created new bill';end if;
 if (select count(*) from public.laundry_pos_cash_ledger)<>4 then raise exception 'refund cash rows incorrect';end if;
 if exists(select 1 from public.laundry_pos_point_links) then raise exception 'test order awarded points';end if;
 perform public.laundry_pos_v3_finance('CASH_ENTRY',gen_random_uuid(),null,'100',null,null,'QA cash deposit','IN');
 perform public.laundry_pos_owner_close_shift(gen_random_uuid(),'100','QA legacy closing');
 perform public.laundry_pos_v3_finance('CASH_ENTRY',gen_random_uuid(),null,'30',null,null,'QA expense','OUT');
 cash_v:=public.laundry_pos_v3_cash();
 if cash_v->>'expected_cash_idr'<>'70' then raise exception 'automatic reopen lost historical balance';end if;
 if (select count(*) from public.laundry_pos_cash_shifts)<>2 then raise exception 'reopen session wrong';end if;
 update public.laundry_pos_staff set active=false where staff_id=staff_v;
 begin perform public.laundry_pos_v3_report(now()-interval '1 hour',now(),device_v,login_v);raise exception 'inactive cashier report allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 execute 'set local role anon';
 begin perform public.laundry_pos_v3_report(now()-interval '1 hour',now());raise exception 'anonymous report allowed';exception when insufficient_privilege then null;end;
 begin perform public.laundry_pos_v3_finance('PAYMENT',gen_random_uuid(),order_v,'1','CASH',4);raise exception 'anonymous finance allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',owner_v::text,true);
end;$test$;
select public.laundry_pos_v3_report(now()-interval '1 hour',now()+interval '1 hour') as report;
rollback;
