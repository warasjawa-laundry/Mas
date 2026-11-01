-- QA integration: one outlet, only owner may provision, no cashier password.
-- All synthetic auth/session/worker data is rolled back.
begin;
set local statement_timeout='15s';
do $test$
declare v_owner uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        v_staff uuid; v_device uuid; v_count integer; v_perm jsonb; v_outlet uuid;
        v_token text:=repeat('A',43);
begin
 if (select count(*) from public.laundry_pos_outlets)<>1 then
   raise exception 'exactly_one_outlet_required';end if;
 select id into v_outlet from public.laundry_pos_outlets where code='MJL'
  and name='Mas Jawa Laundry' and address='Jl. Raya Kandang Jati Kulon RT.06 RW.01, Kandang Jati Kulon, Probolinggo'
  and active and not write_enabled;
 if v_outlet is null then raise exception 'outlet_identity_or_flag_wrong';end if;
 if exists(select 1 from pg_constraint where conrelid='public.laundry_pos_staff'::regclass and contype='f') then
  raise exception 'cashier_still_requires_auth_users';end if;
 if not exists(select 1 from information_schema.columns where table_schema='public'
   and table_name='laundry_pos_staff' and column_name='staff_id') then
  raise exception 'staff_id_missing';end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('laundry_pos_cashier_devices','laundry_pos_cashier_audit') and c.relrowsecurity)<>2 then
   raise exception 'cashier_rls_missing';end if;
 if has_table_privilege('anon','public.laundry_pos_cashier_devices','select')
   or has_table_privilege('authenticated','public.laundry_pos_cashier_devices','insert')
   or has_table_privilege('anon','public.laundry_pos_cashier_audit','select') then
   raise exception 'device_data_exposed';end if;
 if has_function_privilege('anon','public.laundry_pos_owner_save_cashier(uuid,text,jsonb,boolean)','execute')
   or has_function_privilege('anon','public.laundry_pos_owner_pair_cashier(uuid,text)','execute')
   or not has_function_privilege('anon','public.laundry_pos_cashier_session(text)','execute')
   or not has_function_privilege('authenticated','public.laundry_pos_authorized_outlets()','execute') then
   raise exception 'incorrect_public_rpc_grants';end if;
 if not laundry_private.pos_valid_cashier_permissions('{"order_view":true,"refund_full":false}'::jsonb)
  or laundry_private.pos_valid_cashier_permissions('{"owner":true}'::jsonb)
  or laundry_private.pos_valid_cashier_permissions('{"order_create":"true"}'::jsonb)
  or laundry_private.pos_valid_cashier_permissions('[]'::jsonb) then
  raise exception 'permission_whitelist_failed';end if;

 -- No owner JWT: even an authenticated user cannot create cashiers.
 begin
   perform public.laundry_pos_owner_save_cashier(null,'Fake Cashier','{}'::jsonb,true);
   raise exception 'unauthorized_save_accepted';
 exception when sqlstate '42501' then null; end;
 -- Outlets cannot be added, even by an administrator.
 begin
   insert into public.laundry_pos_outlets(code,name,address,active,write_enabled)
   values('OTHER','Illegal extra outlet','Jl. Demo Extra 1, Probolinggo',false,false);
   raise exception 'second_outlet_created';
 exception when unique_violation then null; end;

 -- Synthetic owner exists only until rollback.
 insert into auth.users(id,aud,role) values(v_owner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(v_owner,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 v_staff:=public.laundry_pos_owner_save_cashier(null,'Kasir QA Satu',
   '{"order_view":true,"member_lookup":true}'::jsonb,true);
 if v_staff is null then raise exception 'create_cashier_failed';end if;
 select permissions into v_perm from public.laundry_pos_staff_outlets where staff_id=v_staff;
 if v_perm is distinct from '{"order_view":true,"member_lookup":true}'::jsonb then
   raise exception 'cashier_permissions_not_saved';end if;
 if not exists(select 1 from public.laundry_pos_owner_list_cashiers() where staff_id=v_staff and active) then
   raise exception 'owner_list_cashiers_failed';end if;
 if not exists(select 1 from public.laundry_pos_authorized_outlets() where outlet_id=v_outlet and assigned_role='owner') then
   raise exception 'owner_outlet_access_broken';end if;
 v_device:=public.laundry_pos_owner_pair_cashier(v_staff,v_token);
 if v_device is null then raise exception 'pair_failed';end if;
 if not exists(select 1 from public.laundry_pos_cashier_session(v_token)
     where staff_id=v_staff and outlet_id=v_outlet and not write_enabled) then
   raise exception 'bearer_session_not_usable';end if;
 if exists(select 1 from public.laundry_pos_cashier_session(repeat('B',43))) then
   raise exception 'wrong_token_authorized';end if;
 if exists(select 1 from public.laundry_pos_cashier_session('malformed')) then
   raise exception 'malformed_token_authorized';end if;
 -- Modification is effective on the next token verification (no stale JWT).
 perform public.laundry_pos_owner_save_cashier(v_staff,'Kasir QA Satu',
  '{"order_view":false}'::jsonb,true);
 if (select permissions from public.laundry_pos_cashier_session(v_token))
   is distinct from '{"order_view":false}'::jsonb then raise exception 'permission_change_not_immediate';end if;
 perform public.laundry_pos_owner_revoke_cashier_devices(v_staff);
 if exists(select 1 from public.laundry_pos_cashier_session(v_token)) then
   raise exception 'revocation_failed';end if;
 v_device:=public.laundry_pos_owner_pair_cashier(v_staff,repeat('C',43));
 perform public.laundry_pos_owner_save_cashier(v_staff,'Kasir QA Satu','{}'::jsonb,false);
 if exists(select 1 from public.laundry_pos_cashier_session(repeat('C',43))) then
   raise exception 'deleted_cashier_still_authenticated';end if;
 if not exists(select 1 from public.laundry_pos_cashier_audit where staff_id=v_staff and action='DISABLE') then
   raise exception 'disable_not_audited';end if;
 -- A disabled staff identity can remain in immutable history; never auto-deleted.
 if not exists(select 1 from public.laundry_pos_staff where staff_id=v_staff and not active) then
   raise exception 'soft_delete_lost_identity';end if;
 -- Existing legacy owner privilege must not be expanded to anon/cashier.
 if has_function_privilege('anon','public.laundry_record_amount_visit(uuid,bigint,text,uuid)','execute') then
   raise exception 'legacy_owner_rpc_exposed';end if;
end;
$test$;
rollback;