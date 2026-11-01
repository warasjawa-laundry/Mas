-- G7 synthetic QR authority fixture; rollback-only; never touches production.
begin;
set local statement_timeout='25s';
do $g7$
declare
 v_owner uuid:='aaaa7000-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_device text:=repeat('P',43); v_login text:=repeat('Q',43);
 v_staff uuid;v_member uuid:=gen_random_uuid();v_card uuid;
 v_number bigint;v_name text;
 v_digest text:=encode(extensions.digest('G7-local-QR-secret','sha256'),'hex');
begin
 insert into auth.users(id,aud,role) values(v_owner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(v_owner,true);
 perform set_config('request.jwt.claim.sub',v_owner::text,true);
 v_staff:=public.laundry_pos_owner_save_cashier(null,'Kasir G7 QR Test',
  '{"order_view":true,"order_create":true,"member_lookup":true}'::jsonb,true);
 perform public.laundry_pos_owner_pair_cashier(v_staff,v_device);
 if not public.laundry_pos_cashier_login(v_device,'MAS-0001',v_login) then
  raise exception 'G7 login failed';end if;
 insert into public.laundry_members(id,member_number,display_name,created_by) overriding system value
 values(v_member,777777700,'Synthetic G7 Cardholder',v_owner);
 insert into public.laundry_member_cards(member_id,token_digest,token_ciphertext,issued_by)
 values(v_member,decode(v_digest,'hex'),decode(repeat('ab',60),'hex'),v_owner) returning id into v_card;
 perform set_config('request.jwt.claim.sub','',true);
 select q.member_number,q.display_name into v_number,v_name
 from public.laundry_pos_g7_resolve_card(v_device,v_login,v_digest) q;
 if v_number<>777777700 or v_name<>'Synthetic G7 Cardholder' then
  raise exception 'G7 active card not resolved';end if;
 if exists(select 1 from public.laundry_pos_g7_resolve_card(v_device,v_login,'bad-digest')) or
    exists(select 1 from public.laundry_pos_g7_resolve_card(v_device,v_login,repeat('0',64))) then
  raise exception 'G7 unknown card leaked a member';end if;
 begin
  perform 1 from public.laundry_pos_g7_resolve_card(repeat('Z',43),v_login,v_digest);
  raise exception 'G7 invalid device accepted';
 exception when sqlstate '42501' then null;end;
 update public.laundry_member_cards set revoked_at=clock_timestamp(), revoked_by=v_owner, revoked_reason='G7 test revoke' where id=v_card;
 if exists(select 1 from public.laundry_pos_g7_resolve_card(v_device,v_login,v_digest)) then
  raise exception 'G7 revoked card accepted';end if;
 update public.laundry_member_cards set revoked_at=null, revoked_by=null, revoked_reason=null where id=v_card;
 update public.laundry_members set is_active=false where id=v_member;
 if exists(select 1 from public.laundry_pos_g7_resolve_card(v_device,v_login,v_digest)) then
  raise exception 'G7 inactive member accepted';end if;
 update public.laundry_members set is_active=true where id=v_member;
 update public.laundry_pos_staff_outlets set permissions='{"order_view":true,"order_create":true}'::jsonb where staff_id=v_staff;
 begin
  perform 1 from public.laundry_pos_g7_resolve_card(v_device,v_login,v_digest);
  raise exception 'G7 permission removed but QR accepted';
 exception when sqlstate '42501' then null;end;
 if (select count(*) from public.laundry_pos_point_links)<>0 or
    (select count(*) from public.laundry_checklist_events)<>0 or
    (select count(*) from public.laundry_pos_g7_order_board(v_device,v_login))<>0 then
  raise exception 'G7 read-only scanner wrote visit/point/order';end if;
end;$g7$;
rollback;