-- G7 member name lookup: synthetic data only, all rolled back.
begin;
set local statement_timeout='25s';
do $search$
declare
 v_owner uuid:='aaaa7100-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_staff uuid; v_outlet uuid;
 v_device text:=repeat('N',43);v_login text:=repeat('R',43);
 v_first bigint;v_second bigint;
begin
 select id into strict v_outlet from public.laundry_pos_outlets where code='MJL' and write_enabled=false;
 insert into auth.users(id,aud,role) values(v_owner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(v_owner,true);
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 v_staff:=public.laundry_pos_owner_save_cashier(null,'Kasir G7 Search',
 '{"order_view":true,"order_create":true,"member_lookup":true}'::jsonb,true);
 perform public.laundry_pos_owner_pair_cashier(v_staff,v_device);
 if not public.laundry_pos_cashier_login(v_device,'MAS-2001',v_login) then
  raise exception 'G7 synthetic search login failed';end if;
 insert into public.laundry_members(member_number,display_name,created_by) overriding system value
 values(777777711,'Mawar G7 Same Name',v_owner),
       (777777712,'Mawar G7 Same Name',v_owner),
       (777777713,'Mawar G7 Archived',v_owner),
       (777777714,'Xero G7 Different',v_owner);
 update public.laundry_members set is_active=false where member_number=777777713;
 perform set_config('request.jwt.claim.sub','',true);
 if (select count(*) from public.laundry_pos_g7_member_name(v_device,v_login,'Mawar G7'))<>2 then
  raise exception 'G7 member name prefix did not return both active distinct member numbers';end if;
 select min(member_number),max(member_number) into v_first,v_second
 from public.laundry_pos_g7_member_name(v_device,v_login,'Mawar G7');
 if v_first<>777777711 or v_second<>777777712 then raise exception 'G7 duplicate customer selection not distinct';end if;
 if exists(select 1 from public.laundry_pos_g7_member_name(v_device,v_login,'Ma')) then
  raise exception 'G7 too short prefix revealed members';end if;
 if exists(select 1 from public.laundry_pos_g7_member_name(v_device,v_login,'Mawar%')) then
  raise exception 'G7 wildcard used as query wildcard';end if;
 if exists(select 1 from public.laundry_pos_g7_member_name(v_device,v_login,'NoMatch G7')) then
  raise exception 'G7 unrelated member leaked';end if;
 begin
  perform 1 from public.laundry_pos_g7_member_name(repeat('Z',43),v_login,'Mawar');
  raise exception 'G7 invalid paired device accepted';
 exception when sqlstate '42501' then null; end;
 update public.laundry_pos_staff_outlets set permissions='{"order_view":true}'::jsonb where staff_id=v_staff;
 begin
  perform 1 from public.laundry_pos_g7_member_name(v_device,v_login,'Mawar');
  raise exception 'G7 missing member_lookup accepted';
 exception when sqlstate '42501' then null; end;
 if (select count(*) from public.laundry_checklist_events)>0
    or (select count(*) from public.laundry_pos_point_links)>0 then
  raise exception 'G7 member name lookup wrote visit or points';end if;
end;$search$;
rollback;