begin;
do $test$
declare owner_id uuid:=gen_random_uuid(); staff uuid; device text:=repeat('A',43); login text:=repeat('B',43);
 req uuid:=gen_random_uuid(); result jsonb; order_id uuid; service uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 staff:=public.laundry_pos_owner_save_cashier(null,'Cash recovery QA','{"cash_entry":true,"cash_view":true,"payment_collect":true}'::jsonb,true);
 perform public.laundry_pos_owner_pair_cashier(staff,device);
 if not public.laundry_pos_cashier_login(device,'MAS-0001',login) then raise exception 'login failed';end if;
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true;
 perform public.laundry_pos_g5_open_shift(device,login,gen_random_uuid());
 perform public.laundry_pos_g6_cash_entry(device,login,req,'IN','10000','Synthetic opening');
 perform set_config('request.jwt.claim.sub','',true);
 result:=public.laundry_pos_g4_command_result(device,login,req);
 if result->>'found'<>'true' or result->>'operation'<>'CASH_ENTRY' then raise exception 'cash-only cashier cannot recover own command';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration)
 values(service,'QA','','Recovery service',6000,'kg','6 jam');
 order_id:=(public.laundry_pos_owner_create_order(gen_random_uuid(),'Recovery guest',null,
  jsonb_build_array(jsonb_build_object('service_id',service,'quantity','1','revision',1)),null,null)->>'order_id')::uuid;
 perform public.laundry_pos_owner_save_cashier(staff,'Cash recovery QA','{"order_view":true,"cash_entry":true,"cash_view":true}'::jsonb,true);
 update public.laundry_pos_outlets set finance_enabled=false;
 if public.laundry_pos_g5_financial(device,login,order_id)->>'finance_enabled'<>'false' then raise exception 'UI finance capability not false';end if;
 perform public.laundry_pos_owner_save_cashier(staff,'Cash recovery QA','{"order_view":true}'::jsonb,true);
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.laundry_pos_g4_command_result(device,login,req);
  raise exception 'revoked cash capability still recovers financial data';
 exception when insufficient_privilege then null;end;
end;$test$;
rollback;
