begin;
do $test$
declare owner_id uuid:=gen_random_uuid(); service_id uuid:=gen_random_uuid(); o uuid; r jsonb; request uuid:=gen_random_uuid(); items jsonb;
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true,package_workflow_enabled=false,pilot_test_only=true;
 insert into public.laundry_services(id,category,name,price_idr,unit,duration) values(service_id,'QA','QA archive',4000,'kg','6 jam');
 items:=jsonb_build_array(jsonb_build_object('service_id',service_id,'revision',1,'quantity','1'));
 o:=(public.laundry_pos_owner_create_order(request,'UJI - archive',null,items,null,null)->>'order_id')::uuid;
 perform public.laundry_pos_owner_open_shift(gen_random_uuid());
 perform public.laundry_pos_owner_payment(gen_random_uuid(),o,'4000','CASH',1);
 perform public.laundry_pos_verify_order_contact(o,gen_random_uuid(),'+6280000000000','QA',true);
 r:=laundry_private.pos_retire_test_order(o);
 if r->>'retired' is distinct from 'true' or exists(select 1 from public.laundry_pos_orders where id=o)
 or exists(select 1 from public.laundry_pos_payments where order_id=o)
 or not exists(select 1 from laundry_private.pos_retired_test_orders where order_id=o and jsonb_array_length(snapshot->'payments')=1 and jsonb_array_length(snapshot->'cash')=1)
 then raise exception 'test note not safely retired';end if;
 if laundry_private.pos_retire_test_order(o)->>'retired' is distinct from 'true' then raise exception 'archive retry failed';end if;
 begin
  perform public.laundry_pos_owner_create_order(request,'UJI - archive',null,items,null,null);
  raise exception 'retired command returned phantom invoice';
 exception when invalid_parameter_value then if sqlerrm<>'POS_ORDER_RETIRED' then raise;end if;end;
 update public.laundry_pos_outlets set pilot_test_only=false;
 o:=(public.laundry_pos_owner_create_order(gen_random_uuid(),'QA real-marker guard',null,items,null,null)->>'order_id')::uuid;
 begin
  perform laundry_private.pos_retire_test_order(o);
  raise exception 'normal note retired';
 exception when invalid_parameter_value then if sqlerrm<>'POS_RETIRE_REQUIRES_TEST_ORDER' then raise;end if;end;
 if exists(select 1 from pg_trigger where tgname in ('pos_payments_immutable','pos_ledger_immutable','pos_order_events_immutable','pos_contacts_immutable') and tgenabled<>'O')
 then raise exception 'immutable trigger left disabled';end if;
 if has_function_privilege('anon','laundry_private.pos_retire_test_order(uuid)','execute') or has_function_privilege('authenticated','laundry_private.pos_retire_test_order(uuid)','execute')
 then raise exception 'archive operator function exposed';end if;
end $test$;
rollback;
