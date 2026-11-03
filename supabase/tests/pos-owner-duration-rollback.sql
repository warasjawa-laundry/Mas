-- Synthetic fixtures only; every change is rolled back.
begin;
set local statement_timeout='20s';
do $test$
#variable_conflict use_variable
declare
 owner_id uuid := gen_random_uuid(); outlet_id uuid; staff_id uuid;
 device_token text := repeat('D',43); login_token text := repeat('L',43);
 service_a uuid := gen_random_uuid(); service_b uuid := gen_random_uuid();
 request_id uuid := gen_random_uuid(); items jsonb; result jsonb; order_id uuid;
 stamp timestamptz; pending_id uuid;
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 select id into strict outlet_id from public.laundry_pos_outlets where singleton_key=1;
 update public.laundry_pos_outlets set write_enabled=false where id=outlet_id;
 if not (public.laundry_pos_owner_capabilities() @> '{"write_enabled":false,"duration_support":true}'::jsonb)
 then raise exception 'capability write switch drift';end if;
 -- First RED assertion: the new owner entrypoint does not exist on baseline.
 begin
  perform public.laundry_pos_owner_create_order(request_id,'Owner Guest',null,'[]'::jsonb,null,null);
  raise exception 'owner wrote while disabled';
 exception when insufficient_privilege then null; end;
 staff_id := public.laundry_pos_owner_save_cashier(null,'Duration QA',
  '{"order_view":true,"order_create":true,"member_lookup":true}'::jsonb,true);
 perform public.laundry_pos_owner_pair_cashier(staff_id,device_token);
 if not public.laundry_pos_cashier_login(device_token,
   (select username from public.laundry_pos_staff where laundry_pos_staff.staff_id=staff_id),login_token)
 then raise exception 'fixture login failed'; end if;
 insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration,duration_minutes)
 values(service_a,'Kiloan','Express','Duration A',6000,'kg','6 jam',360),
       (service_b,'Karpet','Regular','Duration B',15000,'m','2 hari',2880);
 items := jsonb_build_array(jsonb_build_object('service_id',service_a,'quantity','1','revision',1),
   jsonb_build_object('service_id',service_b,'quantity','1','revision',1));
 update public.laundry_pos_outlets set write_enabled=true where id=outlet_id;
 result := public.laundry_pos_owner_create_order(request_id,'Owner Guest',null,items,null,null);
 order_id := (result->>'order_id')::uuid;
 select confirmed_at into stamp from public.laundry_pos_orders where id=order_id;
 if not exists(select 1 from public.laundry_pos_orders o where o.id=order_id
   and o.created_by=owner_id and o.created_staff_id is null
   and o.due_at=stamp+interval '2880 minutes' and o.eta_status='SCHEDULED')
 then raise exception 'owner identity or maximum ETA failed'; end if;
 if not exists(select 1 from public.laundry_pos_guest_customers g join public.laundry_pos_orders o on o.guest_id=g.id
   where o.id=order_id and g.created_by=owner_id and g.created_staff_id is null)
 or not exists(select 1 from public.laundry_pos_commands c where c.request_id=request_id
   and c.actor_id=owner_id and c.actor_staff_id is null)
 or not exists(select 1 from public.laundry_pos_order_events e where e.command_id=request_id
   and e.actor_id=owner_id and e.actor_staff_id is null)
 then raise exception 'owner journal XOR failed'; end if;
 begin
  update public.laundry_pos_orders set created_staff_id=staff_id where id=order_id;
  raise exception 'order accepted both actor identities';
 exception when check_violation then null;end;
 begin
  update public.laundry_pos_orders set created_by=null where id=order_id;
  raise exception 'order accepted no actor identity';
 exception when check_violation then null;end;
 if (public.laundry_pos_owner_order_detail(order_id)->>'eta_status')<>'SCHEDULED'
 or (public.laundry_pos_g4_order_detail(device_token,login_token,order_id)->'items'->0->>'duration_minutes')<>'360'
 then raise exception 'detail omitted ETA snapshots';end if;
 update public.laundry_pos_outlets set write_enabled=false where id=outlet_id;
 if public.laundry_pos_owner_create_order(request_id,'Owner Guest',null,items,null,null) is distinct from result
 then raise exception 'flag-off replay lost';end if;
 update public.laundry_pos_outlets set write_enabled=true where id=outlet_id;
 update public.laundry_services set duration='1 jam',duration_minutes=60,category='Changed',
   package_name='Changed',price_idr=9999,revision=2 where id=service_a;
 if not exists(select 1 from public.laundry_pos_order_items i where i.order_id=order_id and i.service_id=service_a
   and i.duration_label='6 jam' and i.duration_minutes=360 and i.category_snapshot='Kiloan'
   and i.package_snapshot='Express' and i.catalog_revision=1 and i.price_idr=6000
   and i.due_at=stamp+interval '360 minutes') then raise exception 'snapshot changed with catalog'; end if;
 if public.laundry_pos_owner_create_order(request_id,'Owner Guest',null,items,null,null) is distinct from result
 then raise exception 'owner replay lost'; end if;
 begin
  perform public.laundry_pos_owner_create_order(gen_random_uuid(),'Owner Guest',null,items,null,null);
  raise exception 'stale catalog accepted';
 exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.laundry_pos_owner_create_order(gen_random_uuid(),'Cashier Impersonation',null,items,null,null);
  raise exception 'cashier reached owner entrypoint';
 exception when insufficient_privilege then null; end;
 begin
  perform public.laundry_pos_g4_create_order(device_token,login_token,request_id,'Owner Guest',null,items,null,null);
  raise exception 'cashier replayed owner request';
 exception when unique_violation then null; end;
 update public.laundry_services set duration='1–3 hari',duration_minutes=null,revision=3 where id=service_a;
 items := jsonb_build_array(jsonb_build_object('service_id',service_a,'quantity','1','revision',3),
   jsonb_build_object('service_id',service_b,'quantity','1','revision',1));
 pending_id := (public.laundry_pos_g4_create_order(device_token,login_token,gen_random_uuid(),
   'Cashier Guest',null,items,null,null)->>'order_id')::uuid;
 if not exists(select 1 from public.laundry_pos_orders o where o.id=pending_id and o.due_at is null
   and o.eta_status='PENDING' and o.created_by is null and o.created_staff_id=staff_id)
 then raise exception 'ambiguous duration invented ETA or cashier actor lost'; end if;
 update public.laundry_pos_invoice_counters set last_sequence=999999 where laundry_pos_invoice_counters.outlet_id=outlet_id;
 if (public.laundry_pos_g4_create_order(device_token,login_token,gen_random_uuid(),
   'Large Invoice',null,items,null,null)->>'invoice_no')<>'MJL-1000000'
 then raise exception 'invoice truncated beyond six digits'; end if;
 if laundry_private.pos_duration_minutes('6 jam',null)<>360
 or laundry_private.pos_duration_minutes('2 hari',null)<>2880
 or laundry_private.pos_duration_minutes('90 menit',null)<>90
 or laundry_private.pos_duration_minutes('1–3 hari',null) is not null
 or laundry_private.pos_duration_minutes('Reguler',null) is not null
 or laundry_private.pos_duration_minutes('',null) is not null
 or laundry_private.pos_duration_minutes('1–3 hari',120)<>120
 then raise exception 'duration resolution policy failed';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.laundry_save_service(service_a,3,jsonb_build_object('category','Kiloan','package_name','Express',
  'name','Duration A','unit','kg','price_idr',6000,'duration','Reguler','duration_minutes',180,
  'position',100,'is_visible',true));
 if not exists(select 1 from public.laundry_services where id=service_a and duration_minutes=180 and revision=4)
 then raise exception 'explicit catalog minutes not editable';end if;
 perform public.laundry_save_service(service_a,4,jsonb_build_object('category','Kiloan','package_name','Express',
  'name','Duration A','unit','kg','price_idr',6000,'duration','Unknown','position',100,'is_visible',true));
 if not exists(select 1 from public.laundry_services where id=service_a and duration_minutes is null and revision=5)
 then raise exception 'changed label retained stale minutes';end if;
 if has_function_privilege('anon','public.laundry_pos_owner_create_order(uuid,text,text,jsonb,text,text)','execute')
 or has_function_privilege('authenticated','laundry_private.pos_create_order_core(uuid,uuid,uuid,uuid,text,text,jsonb,text,text)','execute')
 then raise exception 'owner or shared core ACL exposed'; end if;
end;
$test$;
rollback;
