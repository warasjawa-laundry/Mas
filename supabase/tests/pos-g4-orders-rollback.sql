-- One consolidated Stage 10 regression on ephemeral PG17 / isolated QA.
-- Synthetic cashiers, catalog, invoices, and writes are rolled back atomically.
begin;
set local statement_timeout='20s';
do $g4$
declare
 v_owner uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 v_staff uuid; v_device uuid; v_token text:=repeat('Q',43); v_login text:=repeat('W',43);
 v_other_token text:=repeat('Z',43);
 v_outlet uuid; v_service uuid:=gen_random_uuid(); v_meter uuid:=gen_random_uuid();
 v_items jsonb; v_req uuid:=gen_random_uuid(); v_work uuid:=gen_random_uuid();
 v_result jsonb; v_replay jsonb; v_order uuid; v_bad boolean:=false;
begin
 select id into strict v_outlet from public.laundry_pos_outlets where code='MJL' and write_enabled=false;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname like 'laundry_pos_%' and c.relkind='r' and c.relrowsecurity)<>22 then
  raise exception 'G4 RLS table count drift'; end if;
 if has_table_privilege('anon','public.laundry_pos_orders','select')
 or has_table_privilege('authenticated','public.laundry_pos_commands','insert') then
  raise exception 'G4 direct data privileges exposed';end if;
 if not has_function_privilege('anon','public.laundry_pos_g4_create_order(text,text,uuid,text,text,jsonb,text,text)','execute') then
  raise exception 'G4 entrypoint missing';end if;

 insert into auth.users(id,aud,role) values(v_owner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(v_owner,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 v_staff:=public.laundry_pos_owner_save_cashier(null,'Kasir Nota QA',
  '{"order_view":true,"order_create":true,"order_work":true,"member_lookup":true}'::jsonb,true);
 v_device:=public.laundry_pos_owner_pair_cashier(v_staff,v_token);
 if not public.laundry_pos_cashier_login(v_token,'MAS-0001',v_login) then
  raise exception 'G4 username login missing';end if;
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration)
 values(v_service,'Kiloan','','Cuci dan Setrika',6000,'kg','Reguler'),
       (v_meter,'Karpet','','Cuci Karpet',15000,'M','Reguler');
 v_items:=pg_catalog.jsonb_build_array(
  pg_catalog.jsonb_build_object('service_id',v_service,'quantity','1.255','revision',1),
  pg_catalog.jsonb_build_object('service_id',v_meter,'quantity','2','revision',1));
 if (select count(*) from public.laundry_pos_g4_catalog(v_token,v_login) where id in (v_service,v_meter))<>2 then
  raise exception 'G4 catalog selection';end if;
 if exists(select 1 from public.laundry_pos_g4_member_number(v_token,v_login,'abc')) then
  raise exception 'G4 invalid member disclosed';end if;
 -- Hard stop before allowed rollout: even valid cashier cannot create an order.
 begin
   perform public.laundry_pos_g4_create_order(v_token,v_login,v_req,'Tamu QA',null,v_items,null,null);
   raise exception 'G4 accepted writes while flag off';
 exception when sqlstate '42501' then null; end;
 if (select count(*) from public.laundry_pos_orders)<>0 then
  raise exception 'G4 wrote despite flag off';end if;
 update public.laundry_pos_outlets set write_enabled=true where id=v_outlet;
 v_result:=public.laundry_pos_g4_create_order(v_token,v_login,v_req,'Tamu QA',null,v_items,'Melati','QA');
 v_order:=(v_result->>'order_id')::uuid;
 if v_result->>'invoice_no'<>'MJL-000001' or v_result->>'total_idr'<>'37530' then
  raise exception 'G4 exact IDR error %',v_result;end if;
 if (public.laundry_pos_g4_order_detail(v_token,v_login,v_order)->>'invoice_no')<>'MJL-000001' then
  raise exception 'G4 detail cannot show invoice'; end if;
 if (select count(*) from public.laundry_pos_order_items where order_id=v_order)<>2 then
  raise exception 'G4 missing item lines';end if;
 if not exists(select 1 from public.laundry_pos_orders
  where id=v_order and created_by is null and created_staff_id=v_staff
    and member_id is null and guest_id is not null and work_status='QUEUED' and total_idr=37530) then
  raise exception 'G4 actual cashier attribution or totals failed';end if;
 if not exists(select 1 from public.laundry_pos_commands
  where request_id=v_req and actor_id is null and actor_staff_id=v_staff) then
  raise exception 'G4 command actor attribution failed';end if;
 -- Catalog price updated after commit: SAME retry still returns committed result.
 update public.laundry_services set price_idr=7000,revision=2 where id=v_service;
 v_replay:=public.laundry_pos_g4_create_order(v_token,v_login,v_req,'Tamu QA',null,v_items,'Melati','QA');
 if v_replay is distinct from v_result or (select count(*) from public.laundry_pos_orders)<>1 then
  raise exception 'G4 idempotent replay broken';end if;
 begin
  perform public.laundry_pos_g4_create_order(v_token,v_login,v_req,'Lain',null,v_items,'Melati','QA');
  raise exception 'G4 payload change with same request id accepted';
 exception when unique_violation then null;end;
 begin
  perform public.laundry_pos_g4_create_order(v_token,v_login,gen_random_uuid(),'Tamu QA',null,v_items,null,null);
  raise exception 'G4 stale catalog accepted';
 exception when sqlstate '22023' then null;end;
 if (select count(*) from public.laundry_pos_orders)<>1 then raise exception 'G4 rejected call changed orders';end if;
 -- Read and status transitions are independent from payments and points.
 if (select count(*) from public.laundry_pos_g4_order_list(v_token,v_login))<>1 then
  raise exception 'G4 order list missing';end if;
 if (public.laundry_pos_g4_work_status(v_token,v_login,v_work,v_order,'READY')->>'work_status')<>'READY' then
  raise exception 'G4 ready transition failed';end if;
 if (public.laundry_pos_g4_work_status(v_token,v_login,v_work,v_order,'READY')->>'work_status')<>'READY' then
  raise exception 'G4 work transition replay failed';end if;
 begin
  perform public.laundry_pos_g4_work_status(v_token,v_login,gen_random_uuid(),v_order,'QUEUED');
  raise exception 'G4 illegal transition accepted';
 exception when sqlstate '22023' then null;end;
 begin
  perform public.laundry_pos_g4_work_status(v_token,v_login,gen_random_uuid(),v_order,'COLLECTED');
  raise exception 'G4 unpaid handover accepted';
 exception when sqlstate '22023' then
  if sqlerrm<>'POS_HANDOVER_REQUIRES_SETTLED_PAYMENT' then raise;end if;
 end;
 if (select count(*) from public.laundry_pos_payments)<>0 or
    (select count(*) from public.laundry_pos_point_links)<>0 or
    (select count(*) from public.laundry_amount_transactions)<>0 then
  raise exception 'G4 accidentally posted financial records';end if;
 -- Revocation effective immediately; no token-only shortcut / unauthorized info.
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 perform public.laundry_pos_owner_revoke_cashier_devices(v_staff);
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 begin
  perform 1 from public.laundry_pos_g4_order_list(v_token,v_login);
  raise exception 'G4 revoked device retained order access';
 exception when sqlstate '42501' then null;end;
 begin
  perform 1 from public.laundry_pos_g4_order_list(v_other_token,v_login);
  raise exception 'G4 fake device read';
 exception when sqlstate '42501' then null;end;
end;
$g4$;
rollback;