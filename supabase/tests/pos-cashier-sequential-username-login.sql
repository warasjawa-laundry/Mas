-- G3 extension: username allocation and login on the owner's paired device.
-- Tests are entirely synthetic and ROLLBACK (also on clean PostgreSQL CI).
begin;
set local statement_timeout='20s';
do $test$
declare
 v_owner uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 v_one uuid; v_two uuid;v_three uuid; v_outlet uuid;
 v_device text:=repeat('D',43);
 v_login text:=repeat('E',43);
 v_login2 text:=repeat('F',43);
 v_i integer;
 v_result boolean;
begin
 if (select count(*) from public.laundry_pos_outlets)<>1 then
  raise exception 'single_outlet_required';end if;
 select id into strict v_outlet from public.laundry_pos_outlets where code='MJL';
 if (select last_cashier_number from public.laundry_pos_outlets where id=v_outlet)<>0 then
  raise exception 'synthetic_QA_must_start_without_cashiers';end if;
 if (select count(*) from public.laundry_pos_cashier_logins)<>0 then
  raise exception 'synthetic_QA_must_have_no_logins';end if;
 if has_table_privilege('anon','public.laundry_pos_cashier_logins','select')
   or has_table_privilege('authenticated','public.laundry_pos_cashier_logins','insert')
   or has_function_privilege('anon','public.laundry_pos_owner_save_cashier(uuid,text,jsonb,boolean)','execute')
   or not has_function_privilege('anon','public.laundry_pos_cashier_login(text,text,text)','execute') then
   raise exception 'username_permissions_mismatch';end if;

 -- Without an owner session, username allocation and provisioning fail.
 begin
  perform public.laundry_pos_owner_save_cashier(null,'Pelanggar','{}'::jsonb,true);
  raise exception 'unauthorized_owner_save_passed';
 exception when sqlstate '42501' then null;end;
 if public.laundry_pos_cashier_login(v_device,'MAS-2001',v_login) then
  raise exception 'unpaired_device_login_accepted';end if;

 -- Owner exists only inside rollback transaction.
 insert into auth.users(id,aud,role) values(v_owner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(v_owner,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',v_owner::text,true);
 v_one:=public.laundry_pos_owner_save_cashier(null,'Kasir QA Satu',
    '{"order_create":true}'::jsonb,true);
 v_two:=public.laundry_pos_owner_save_cashier(null,'Kasir QA Dua','{}'::jsonb,true);
 if (select username from public.laundry_pos_staff where staff_id=v_one)<>'MAS-2001'
   or (select username from public.laundry_pos_staff where staff_id=v_two)<>'MAS-2002'
   or (select last_cashier_number from public.laundry_pos_outlets where id=v_outlet)<>2 then
  raise exception 'username_sequence_invalid';end if;
 if (select username from public.laundry_pos_owner_list_cashiers() where staff_id=v_two)<>'MAS-2002' then
  raise exception 'owner_username_listing_missing';end if;
 -- Owner edits same cashier, username must be stable; even direct privileged edit fails.
 perform public.laundry_pos_owner_save_cashier(v_one,'Kasir QA Satu Baru','{}'::jsonb,true);
 if (select username from public.laundry_pos_staff where staff_id=v_one)<>'MAS-2001' then
  raise exception 'rename_changed_username';end if;
 begin
  update public.laundry_pos_staff set username='MAS-0099' where staff_id=v_one;
  raise exception 'direct_username_edit_passed';
 exception when sqlstate '42501' then null;end;
 -- Deletion does not recycle numbers.
 perform public.laundry_pos_owner_save_cashier(v_two,'Kasir QA Dua','{}'::jsonb,false);
 v_three:=public.laundry_pos_owner_save_cashier(null,'Kasir QA Tiga','{}'::jsonb,true);
 if (select username from public.laundry_pos_staff where staff_id=v_three)<>'MAS-2003' then
  raise exception 'deleted_username_reused';end if;
 begin
  insert into public.laundry_pos_staff(display_name,active,username)
    values('Duplicate QA',true,'MAS-2001');
  raise exception 'unique_username_not_enforced';
 exception when unique_violation then null;end;

 -- Pairing one staff pins identity to this one device. A different username
 -- cannot select another staff on it even if both accounts are active.
 perform public.laundry_pos_owner_pair_cashier(v_one,v_device);
 if exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,v_login)) then
  raise exception 'device_without_username_authorized';end if;
 if public.laundry_pos_cashier_login(v_device,'MAS-2003',v_login) then
  raise exception 'other_cashier_impersonation';end if;
 if (select failed_username_attempts from public.laundry_pos_cashier_devices
    where token_digest=extensions.digest(v_device,'sha256'))<>1 then
  raise exception 'failed_attempt_not_recorded';end if;
 if not public.laundry_pos_cashier_login(v_device,'MAS-2001',v_login) then
  raise exception 'correct_username_login_rejected';end if;
 if not exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,v_login)
    where staff_id=v_one and username='MAS-2001' and not write_enabled) then
  raise exception 'two_cookie_session_invalid';end if;
 if exists(select 1 from public.laundry_pos_cashier_logged_in(repeat('Z',43),v_login))
   or exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,repeat('Z',43))) then
  raise exception 'session_token_or_device_missing_but_accepted';end if;
 if not public.laundry_pos_cashier_login(v_device,'MAS-2001',v_login2) then
  raise exception 'relogin_fails';end if;
 if exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,v_login))
   or not exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,v_login2)) then
  raise exception 'previous_login_not_revoked';end if;
 if not public.laundry_pos_cashier_logout(v_login2) then
  raise exception 'logout_failed';end if;
 if exists(select 1 from public.laundry_pos_cashier_logged_in(v_device,v_login2)) then
  raise exception 'logout_did_not_revoke';end if;

 -- Five wrong usernames lock paired device briefly: no easy enumeration.
 for v_i in 1..5 loop
  if public.laundry_pos_cashier_login(v_device,'MAS-2002',repeat('G',43)) then
    raise exception 'failed_login_accidentally_accepted';end if;
 end loop;
 if (select failed_username_attempts from public.laundry_pos_cashier_devices
    where token_digest=extensions.digest(v_device,'sha256'))<>5 then
   raise exception 'lockout_counter_invalid';end if;
 if public.laundry_pos_cashier_login(v_device,'MAS-2001',repeat('H',43)) then
  raise exception 'lockout_did_not_block_valid_username';end if;
 -- Owner device revocation invalidates both cookie requirements.
 perform public.laundry_pos_owner_revoke_cashier_devices(v_one);
 if public.laundry_pos_cashier_login(v_device,'MAS-2001',repeat('I',43)) then
  raise exception 'revoked_device_can_login';end if;
 if (select count(*) from public.laundry_pos_outlets)<>1 then
  raise exception 'second_outlet_created';end if;
end;
$test$;
rollback;