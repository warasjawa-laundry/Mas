-- Synthetic G3 correction regression, safe on dedicated QA and CI. NEVER run on production.
begin;
set local statement_timeout='20s';
do $test$
declare
 v_owner uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 v_staff uuid; v_device text:=repeat('D',43);v_login text:=repeat('L',43);
 v_outlet uuid; v_throttle integer;v_i integer;
begin
 select id into strict v_outlet from public.laundry_pos_outlets where code='MJL' and write_enabled=false;
 if has_table_privilege('anon','laundry_private.pos_cashier_id_login_throttle','select')
    or has_table_privilege('authenticated','public.laundry_pos_cashier_devices','insert')
    or has_function_privilege('anon','public.laundry_pos_owner_save_cashier(uuid,text,jsonb,boolean)','execute')
    or not has_function_privilege('anon','public.laundry_pos_cashier_direct_id_login(text,text,text)','execute') then
   raise exception 'direct_login_acl_drift';end if;
 if public.laundry_pos_cashier_direct_id_login('MAS-0000',v_device,v_login) then
   raise exception 'reserved_zero_login_passed';end if;
 if public.laundry_pos_cashier_direct_id_login('MAS-2001',v_device,v_login) then
   raise exception 'nonexistent_cashier_accepted';end if;
 insert into auth.users(id,aud,role) values(v_owner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(v_owner,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 v_staff:=public.laundry_pos_owner_save_cashier(null,'Kasir QA Tanpa Pair',
   '{"order_view":true,"order_create":true,"payment_collect":true}'::jsonb,true);
 if (select username from public.laundry_pos_staff where staff_id=v_staff)<>'MAS-2001' then
   raise exception 'four_digit_employee_id_invalid';end if;
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 if not public.laundry_pos_cashier_direct_id_login('MAS-2001',v_device,v_login) then
   raise exception 'id_only_login_rejected';end if;
 if not exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,v_login)
   where staff_id=v_staff and username='MAS-2001' and not write_enabled) then
   raise exception 'two_token_session_missing';end if;
 if not exists(select 1 from public.laundry_pos_cashier_devices
   where token_digest=extensions.digest(v_device,'sha256') and issued_by is null and login_origin='DIRECT_ID'
     and expires_at<=clock_timestamp()+interval '12 hours') then
   raise exception 'device_actor_provenance_or_expiry_invalid';end if;
 if exists(select 1 from public.laundry_pos_cashier_logged_in(repeat('Z',43),v_login))
   or exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,repeat('Z',43))) then
   raise exception 'session_bypass';end if;
 -- Invalid / unknown IDs count against shared throttle; cannot enumerate for free.
 for v_i in 1..9 loop
   if public.laundry_pos_cashier_direct_id_login('MAS-9999',repeat('A',43),repeat('B',43)) then
      raise exception 'guess_accepted';end if;
 end loop;
 if public.laundry_pos_cashier_direct_id_login('MAS-2001',repeat('C',43),repeat('E',43)) then
   raise exception 'global_guess_limit_bypassed';end if;
 select attempts into v_throttle from laundry_private.pos_cashier_id_login_throttle where singleton=1;
 if v_throttle<>10 or not exists(select 1 from laundry_private.pos_cashier_id_login_throttle
       where locked_until>clock_timestamp()) then
   raise exception 'throttle_did_not_lock_after_ten';end if;
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 perform public.laundry_pos_owner_revoke_cashier_devices(v_staff);
 perform pg_catalog.set_config('request.jwt.claim.sub','',true);
 if exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,v_login)) then
   raise exception 'owner_revoke_failed';end if;
 if (select count(*) from public.laundry_pos_payments)<>0
    or (select count(*) from public.laundry_pos_point_links)<>0 then
   raise exception 'login_created_financial_rows';end if;
end;
$test$;
rollback;