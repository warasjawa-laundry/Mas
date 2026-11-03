-- Synthetic QA only. No Production members or persisted fixture data.
begin;
set local statement_timeout='25s';
do $test$
declare owner_id uuid:=gen_random_uuid(); service_id uuid:=gen_random_uuid(); member_id_v uuid:=gen_random_uuid();
 pilot uuid; actual uuid; guest uuid; r jsonb; preview jsonb; items jsonb; rule_v public.laundry_point_rules;
 year_v integer:=extract(year from timezone('Asia/Jakarta',statement_timestamp()))::integer;
 expected integer; delivery_rev bigint; final_request uuid:=gen_random_uuid(); refund_request uuid:=gen_random_uuid();
 final_result jsonb; refund_result jsonb; cashier uuid; login_name text; device text:=repeat('M',43); login text:=repeat('N',43);
 boundary uuid; command_v uuid:=gen_random_uuid(); outlet uuid; shift_v uuid;
begin
 begin
  perform public.laundry_pos_point_simulation();raise exception 'anonymous simulation allowed';
 exception when insufficient_privilege then null;end;
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true,package_workflow_enabled=false,pilot_test_only=true;
 select id into outlet from public.laundry_pos_outlets where singleton_key=1;
 insert into public.laundry_services(id,category,name,price_idr,unit,duration) values(service_id,'QA','QA points',72000,'kg','6 jam');
 items:=jsonb_build_array(jsonb_build_object('service_id',service_id,'quantity','1','revision',1));
 select revision into delivery_rev from laundry_private.pos_delivery_options where code='NEAR';
 select * into strict rule_v from public.laundry_point_rules where program_year=year_v;
 select coalesce(max((value->>'points')::integer),0) into expected from jsonb_array_elements(rule_v.tiers) where (value->>'minimum')::bigint<=75000;
 execute 'set local role authenticated';
 preview:=public.laundry_pos_point_simulation(null,items,'NEAR',delivery_rev);
 execute 'reset role';
 if preview->>'total_idr'<>'75000' or preview->>'points'<>expected::text or preview->>'booked'<>'false' or preview->>'state'<>'ESTIMATE'
 then raise exception 'authoritative preview wrong %',preview;end if;
 begin
  perform public.laundry_pos_point_simulation(null,items,'NEAR',delivery_rev+1);raise exception 'stale delivery accepted';
 exception when invalid_parameter_value then if sqlerrm<>'POS_DELIVERY_PRICE_CHANGED' then raise;end if;end;
 update public.laundry_services set price_idr=73000,revision=2 where id=service_id;
 begin
  perform public.laundry_pos_point_simulation(null,items,'NEAR',delivery_rev);raise exception 'stale service accepted';
 exception when invalid_parameter_value then if sqlerrm<>'POS_CATALOG_CHANGED' then raise;end if;end;
 update public.laundry_services set price_idr=72000,revision=1 where id=service_id;
 pilot:=(public.laundry_pos_owner_create_order_with_delivery(gen_random_uuid(),'UJI - Poin QA',null,items,'Sakura',null,'NEAR',delivery_rev)->>'order_id')::uuid;
 perform public.laundry_pos_owner_open_shift(gen_random_uuid());
 if public.laundry_pos_point_simulation(pilot)->>'state'<>'UNPAID' then raise exception 'unpaid simulation wrong';end if;
 perform public.laundry_pos_owner_payment(gen_random_uuid(),pilot,'25000','CASH',1);
 if public.laundry_pos_point_simulation(pilot)->>'state'<>'PARTIAL' then raise exception 'DP simulation wrong';end if;
 perform public.laundry_pos_owner_payment(gen_random_uuid(),pilot,'50000','NONCASH',2);
 if public.laundry_pos_point_simulation(pilot)->>'state'<>'PAID' then raise exception 'settled simulation wrong';end if;
 update public.laundry_services set price_idr=1000,revision=2 where id=service_id;
 if public.laundry_pos_point_simulation(pilot)->>'total_idr'<>'75000' then raise exception 'simulation changed invoice history';end if;
 update public.laundry_services set price_idr=72000,revision=1 where id=service_id;
 update public.laundry_point_rules set revision=rule_v.revision+1,tiers=(select jsonb_agg(value||jsonb_build_object('points',(value->>'points')::integer+1)) from jsonb_array_elements(rule_v.tiers)) where program_year=year_v;
 r:=public.laundry_pos_point_simulation(pilot);
 if r->>'points'<>(expected+1)::text or r->>'rule_revision'<>(rule_v.revision+1)::text then raise exception 'changed rule ignored';end if;
 update public.laundry_point_rules set tiers=rule_v.tiers,revision=rule_v.revision where program_year=year_v;
 perform public.laundry_pos_owner_refund_full(gen_random_uuid(),pilot,'QA simulation refund',3);
 if public.laundry_pos_point_simulation(pilot)->>'state'<>'REFUNDED' or exists(select 1 from public.laundry_pos_point_links where order_id=pilot)
 then raise exception 'pilot posted points or refund simulation wrong';end if;
 begin
  update public.laundry_pos_orders set member_id=member_id_v where id=pilot;raise exception 'test member linked';
 exception when invalid_parameter_value then if sqlerrm<>'POS_TEST_ORDER_IMMUTABLE' then raise;end if;end;
 -- Different year rules are read independently. The payment timestamp fixture below is synthetic, not an RPC payment claim.
 update public.laundry_point_rules set tiers=(select jsonb_agg(value||jsonb_build_object('points',(value->>'points')::integer+2)) from jsonb_array_elements(rule_v.tiers)),revision=2 where program_year=2027;
 boundary:=(public.laundry_pos_owner_create_order_with_delivery(gen_random_uuid(),'UJI - Year boundary QA',null,items,null,null,'NEAR',delivery_rev)->>'order_id')::uuid;
 select id into shift_v from public.laundry_pos_cash_shifts where outlet_id=outlet and closed_at is null;
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,operation,target_id,payload_digest,result) values(command_v,outlet,owner_id,'PAYMENT',boundary,extensions.digest('QA boundary','sha256'),'{}');
 insert into public.laundry_pos_payments(order_id,outlet_id,command_id,shift_id,entry_type,method,amount_idr,confirmed_by,confirmed_at)
  values(boundary,outlet,command_v,shift_v,'RECEIPT','NONCASH',75000,owner_id,'2027-01-01T00:30:00+07');
 r:=public.laundry_pos_point_simulation(boundary);
 if r->>'program_year'<>'2027' or r->>'points'<>(expected+2)::text then raise exception 'settlement year not used %',r;end if;
 if laundry_private.pos_simulation_points(75000,2026,'ESTIMATE',false)->>'program_year'<>'2026' then raise exception '2026 mixed';end if;
 -- A missing current rule must remain unavailable, never a fabricated zero; no actual amount ledger exists yet.
 delete from public.laundry_point_rules where program_year=year_v;
 r:=public.laundry_pos_point_simulation(null,items,'NEAR',delivery_rev);
 if r->>'rule_available'<>'false' or r->'points' is distinct from 'null'::jsonb then raise exception 'missing rule replaced by points';end if;
 update public.laundry_pos_outlets set pilot_test_only=false;
 insert into public.laundry_members(id,member_number,display_name,created_by) overriding system value values(member_id_v,987654991,'Synthetic Points QA',owner_id);
 actual:=(public.laundry_pos_owner_create_order_with_delivery(gen_random_uuid(),null,'987654991',items,null,null,'NEAR',delivery_rev)->>'order_id')::uuid;
 perform public.laundry_pos_owner_payment(gen_random_uuid(),actual,'25000','CASH',1);
 if exists(select 1 from public.laundry_amount_transactions where member_id=member_id_v) then raise exception 'DP awarded actual points';end if;
 begin
  perform public.laundry_pos_owner_payment(final_request,actual,'50000','CASH',2);raise exception 'missing rule accepted final payment';
 exception when invalid_parameter_value then if sqlerrm<>'POINT_RULE_MISSING' then raise;end if;end;
 insert into public.laundry_point_rules(program_year,tiers,revision,updated_at,updated_by) values(rule_v.program_year,rule_v.tiers,rule_v.revision,rule_v.updated_at,rule_v.updated_by);
 begin
  perform public.laundry_pos_owner_payment(gen_random_uuid(),actual,'50001','CASH',2);raise exception 'overpayment accepted';
 exception when invalid_parameter_value then if sqlerrm<>'POS_OVERPAYMENT' then raise;end if;end;
 final_result:=public.laundry_pos_owner_payment(final_request,actual,'50000','CASH',2);
 if final_result->>'points_awarded'<>expected::text or public.laundry_pos_owner_payment(final_request,actual,'50000','CASH',2)<>final_result
 then raise exception 'actual points/retry wrong';end if;
 if (select count(*) from public.laundry_pos_point_links where order_id=actual and link_type='ADD')<>1
 or (select points_total from public.laundry_owner_point_balances(member_id_v) where program_year=year_v)<>expected
 or (select count(*) from public.laundry_amount_transactions where member_id=member_id_v and amount_idr=75000)<>1
 then raise exception 'actual balance/history wrong';end if;
 begin
  perform public.laundry_pos_owner_payment(gen_random_uuid(),actual,'1','CASH',3);raise exception 'extra payment accepted';
 exception when invalid_parameter_value then null;end;
 refund_result:=public.laundry_pos_owner_refund_full(refund_request,actual,'QA actual reversal',3);
 if public.laundry_pos_owner_refund_full(refund_request,actual,'QA actual reversal',3)<>refund_result
 or (select points_total from public.laundry_owner_point_balances(member_id_v) where program_year=year_v)<>0
 or (select count(*) from public.laundry_pos_point_links where order_id=actual and link_type='VOID')<>1
 then raise exception 'actual refund balance/retry wrong';end if;
 -- Current rules are re-read at final settlement; already posted snapshots remain unchanged.
 update public.laundry_point_rules set revision=rule_v.revision+1,tiers=(select jsonb_agg(value||jsonb_build_object('points',(value->>'points')::integer+1)) from jsonb_array_elements(rule_v.tiers)) where program_year=year_v;
 if (select awarded_points from public.laundry_pos_point_links where order_id=actual and link_type='ADD')<>expected then raise exception 'historical award changed with rules';end if;
 actual:=(public.laundry_pos_owner_create_order_with_delivery(gen_random_uuid(),null,'987654991',items,null,null,'NEAR',delivery_rev)->>'order_id')::uuid;
 perform public.laundry_pos_owner_payment(gen_random_uuid(),actual,'25000','CASH',1);
 r:=public.laundry_pos_owner_payment(gen_random_uuid(),actual,'50000','CASH',2);
 if r->>'points_awarded'<>(expected+1)::text or (select rule_revision from public.laundry_pos_point_links where order_id=actual and link_type='ADD')<>rule_v.revision+1 then raise exception 'current settlement rules ignored';end if;
 perform public.laundry_pos_owner_refund_full(gen_random_uuid(),actual,'QA changed-rule refund',3);
 if (select points_total from public.laundry_owner_point_balances(member_id_v) where program_year=year_v)<>0 then raise exception 'changed-rule refund wrong';end if;
 update public.laundry_point_rules set tiers=rule_v.tiers,revision=rule_v.revision where program_year=year_v;
 guest:=(public.laundry_pos_owner_create_order_with_delivery(gen_random_uuid(),'QA guest',null,items,null,null,'NEAR',delivery_rev)->>'order_id')::uuid;
 perform public.laundry_pos_owner_payment(gen_random_uuid(),guest,'75000','CASH',1);
 if exists(select 1 from public.laundry_pos_point_links where order_id=guest) or public.laundry_pos_point_simulation(guest) is not null
 then raise exception 'normal guest awarded/simulated member points';end if;
 cashier:=public.laundry_pos_owner_save_cashier(null,'QA point viewer','{"order_view":true,"order_create":true}',true);
 select username into login_name from public.laundry_pos_staff where staff_id=cashier;
 perform public.laundry_pos_owner_pair_cashier(cashier,device);
 perform public.laundry_pos_cashier_login(device,login_name,login);
 perform set_config('request.jwt.claim.sub','',true);
 execute 'set local role anon';
 r:=public.laundry_pos_point_simulation(pilot,null,null,null,device,login);
 execute 'reset role';
 if r->>'state'<>'REFUNDED' then raise exception 'cashier simulation unavailable';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.laundry_pos_owner_save_cashier(cashier,'QA point viewer','{"whatsapp_draft":true}',true);
 perform set_config('request.jwt.claim.sub','',true);
 if public.laundry_pos_point_simulation(pilot,null,null,null,device,login)->>'state'<>'REFUNDED' then raise exception 'receipt grant regressed';end if;
 begin
  perform public.laundry_pos_point_simulation(null,items,'NEAR',delivery_rev,device,login);raise exception 'receipt-only cashier preview allowed';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.laundry_pos_owner_save_cashier(cashier,'QA point viewer','{"order_view":true}',true);
 perform public.laundry_pos_owner_revoke_cashier_devices(cashier);
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.laundry_pos_point_simulation(pilot,null,null,null,device,login);raise exception 'revoked simulation allowed';
 exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','laundry_private.pos_simulation_points(bigint,integer,text,boolean)','execute')
 or has_function_privilege('authenticated','laundry_private.pos_simulation_points(bigint,integer,text,boolean)','execute') then raise exception 'private scoring exposed';end if;
end $test$;
rollback;
