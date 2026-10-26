-- Synthetic fixtures; member and contact data must never enter the public payload.
begin;
create temporary table promotion_details_context(digest text);
grant select on promotion_details_context to anon;
do $setup$
declare o uuid:=gen_random_uuid(); m uuid; other_m uuid;
 d text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
begin
 insert into auth.users(id,aud,role) values(o,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id) values(o);
 insert into public.laundry_members(display_name,created_by,whatsapp_e164,address)
 values('Private customer',o,'+628123456789','PRIVATE ADDRESS') returning id into m;
 insert into public.laundry_members(display_name,created_by) values('Other member',o) returning id into other_m;
 insert into public.laundry_member_cards(member_id,token_digest,token_ciphertext,issued_by)
 values(m,decode(d,'hex'),decode(repeat('ab',71),'hex'),o);
 insert into public.laundry_member_promotions(member_id,title,terms,expires_at,created_by,request_id)
 values(m,'Available promo','Only regular laundry',now()+interval '1 day',o,gen_random_uuid()),
 (m,'Expired promo','HIDDEN',now()-interval '1 day',o,gen_random_uuid()),
 (other_m,'Other member promo','HIDDEN',null,o,gen_random_uuid());
 insert into promotion_details_context values(d);
end $setup$;
set local role anon;
do $verify$
declare payload jsonb; item jsonb; denied boolean:=false;
begin
 select promos into payload from public.laundry_public_card_progress((select digest from promotion_details_context));
 if jsonb_array_length(payload)<>1 then raise exception 'Unavailable or cross-member promo exposed';end if;
 item:=payload->0;
 if item->>'title'<>'Available promo' or item->>'terms'<>'Only regular laundry'
   or (item->>'expires_at')::timestamptz is distinct from now()+interval '1 day'
 then raise exception 'Member-facing promo details missing';end if;
 if (select count(*) from jsonb_object_keys(item))<>4
   or not(item ?& array['title','status','terms','expires_at'])
 then raise exception 'Unexpected fields in public promo';end if;
 if exists(select 1 from public.laundry_public_card_progress(repeat('0',64))) then raise exception 'Unknown card accepted';end if;
 begin perform * from public.laundry_member_promotions;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous table access granted';end if;
end $verify$;
reset role;
rollback;
