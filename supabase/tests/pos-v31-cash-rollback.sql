begin;
set local statement_timeout='30s';
do $test$
declare owner_v uuid:=gen_random_uuid();request_v uuid:=gen_random_uuid();legacy_v uuid:=gen_random_uuid();
 result_v jsonb;again_v jsonb;cash_v jsonb;report_v jsonb;category_v text;before_v bigint;order_v uuid;family_v uuid:=gen_random_uuid();service_v uuid;
 staff_v uuid;name_v text;device_v text:=repeat('k',43);login_v text:=repeat('l',43);
begin
 insert into auth.users(id,aud,role) values(owner_v,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_v,true);
 perform set_config('request.jwt.claim.sub',owner_v::text,true);
 update public.laundry_pos_outlets set active=true,write_enabled=true,finance_enabled=true,pilot_test_only=true,package_workflow_enabled=true;
 if (select count(*) from laundry_private.pos_v31_cash_categories where classification='EXPENSE')<>8 then raise exception 'expense categories missing';end if;
 result_v:=public.laundry_pos_v31_cash_entry(request_v,'OUT','5000','PACKAGING',null);
 again_v:=public.laundry_pos_v31_cash_entry(request_v,'OUT','5000','PACKAGING','');
 if result_v<>again_v or result_v->>'status'<>'POSTED' then raise exception 'cash retry changed result';end if;
 if (select count(*) from public.laundry_pos_cash_ledger where command_id=request_v)<>1 then raise exception 'cash retry duplicated ledger';end if;
 begin perform public.laundry_pos_v31_cash_entry(request_v,'OUT','5000','OTHER',null);raise exception 'category conflict accepted';exception when unique_violation then null;end;
 begin perform public.laundry_pos_v31_cash_entry(request_v,'OUT','5000','PACKAGING','different');raise exception 'note conflict accepted';exception when unique_violation then null;end;
 begin perform public.laundry_pos_v31_cash_entry(request_v,'OUT','5001','PACKAGING',null);raise exception 'amount conflict accepted';exception when unique_violation then null;end;
 begin perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'IN','1','PACKAGING',null);raise exception 'expense in accepted';exception when invalid_parameter_value then null;end;
 begin perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'OUT','1','WRONG',null);raise exception 'unknown category accepted';exception when invalid_parameter_value then null;end;
 begin perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'OUT','1','OTHER',E'\n');raise exception 'control note accepted';exception when invalid_parameter_value then null;end;
 begin perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'OUT','1','OTHER',repeat('x',301));raise exception 'long note accepted';exception when invalid_parameter_value then null;end;
 foreach category_v in array array['DETERGENT','PERFUME','UTILITIES','TRANSPORT','MAINTENANCE','PAYROLL','OTHER','CAPITAL','CASH_TRANSFER'] loop
  perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'OUT','10',category_v,'QA');
 end loop;
 perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'IN','100','CAPITAL','Modal awal');
 perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'IN','100','CASH_TRANSFER','Dari kas lain');
 perform public.laundry_pos_v3_finance('CASH_ENTRY',legacy_v,null,'20',null,null,'QA legacy cash','OUT');
 begin perform public.laundry_pos_v31_cash_entry(legacy_v,'OUT','20','OTHER',null);raise exception 'legacy request silently recategorized';exception when unique_violation then null;end;
 cash_v:=public.laundry_pos_v3_cash();
 if not exists(select 1 from jsonb_array_elements(cash_v->'entries')e where e->>'expense_category_code'='PACKAGING' and e->>'accounting_classification'='EXPENSE' and e->>'actor'='Owner MasJawa') then raise exception 'structured cash read missing';end if;
 if not exists(select 1 from jsonb_array_elements(cash_v->'entries')e where e->>'note'='QA legacy cash' and e->>'expense_category_code' is null) then raise exception 'legacy category altered';end if;
 begin update laundry_private.pos_v31_cash_metadata set note='changed' where request_id=request_v;raise exception 'metadata mutable';exception when insufficient_privilege then null;end;

 perform public.laundry_pos_save_package('REGULAR',(select revision from public.laundry_pos_duration_packages where code='REGULAR'),'Reguler',4320,true);
 perform public.laundry_pos_save_family(family_v,0,'{"name":"QA V31 kg","category":"QA V31","unit":"kg","position":1,"active":true}',
  '[{"code":"REGULAR","price_idr":"6000","active":true},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
 select id into service_v from public.laundry_services where family_id=family_v and duration_package_code='REGULAR';
 order_v:=(public.laundry_pos_owner_create_order(gen_random_uuid(),'UJI - V31 cash',null,
  jsonb_build_array(jsonb_build_object('service_id',service_v,'quantity','0.75','revision',1),jsonb_build_object('service_id',service_v,'quantity','1.25','revision',1)),null,null)->>'order_id')::uuid;
 perform public.laundry_pos_v3_finance('PAYMENT',gen_random_uuid(),order_v,'3000','CASH',1);
 perform public.laundry_pos_v3_finance('PAYMENT',gen_random_uuid(),order_v,'9000','QRIS',2);
 select count(*) into before_v from public.laundry_pos_cash_ledger;
 report_v:=public.laundry_pos_v3_report(clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour');
 if jsonb_array_length(report_v->'cash')<>before_v or (select count(*) from public.laundry_pos_cash_ledger)<>before_v then raise exception 'read changed or multiplied journal';end if;
 if not exists(select 1 from jsonb_array_elements(report_v->'cash')e where e->>'order_id'=order_v::text and e->>'item_count'='2' and e->'quantities_milli'->>'kg'='2000' and e->>'quantity_summary'='2 kg') then raise exception 'item summary wrong';end if;
 if (select sum((e->>'amount')::bigint) from jsonb_array_elements(report_v->'cash')e where e->>'order_id'=order_v::text)<>12000 then raise exception 'cash multiplied by items';end if;
 staff_v:=public.laundry_pos_owner_save_cashier(null,'QA V31 cash cashier','{"cash_view":true,"cash_entry":false,"reports_view":true,"order_view":false}',true);
 select username into name_v from public.laundry_pos_staff where staff_id=staff_v;
 perform set_config('request.jwt.claim.sub','',true);
 if not public.laundry_pos_cashier_direct_id_login(name_v,device_v,login_v) then raise exception 'cashier login failed';end if;
 cash_v:=public.laundry_pos_v3_cash(device_v,login_v);
 if exists(select 1 from jsonb_array_elements(cash_v->'entries')e where e->>'customer' is not null or e->>'can_view_order'='true') then raise exception 'cash enrichment exposed customer';end if;
 begin perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'OUT','1','OTHER',null,device_v,login_v);raise exception 'cash write permission bypass';exception when insufficient_privilege then null;end;
 execute 'set local role anon';
 begin perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'OUT','1','OTHER');raise exception 'anonymous cash write accepted';exception when insufficient_privilege then null;end;
 begin perform public.laundry_pos_v3_cash();raise exception 'anonymous cash read accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
end;$test$;
rollback;
