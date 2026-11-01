-- G7 UX: scoped, bounded member lookup by prefix. Never return phone/address/QR/poin.
-- Additive to G7 QR; no financial writes and no raw table permissions.
create function laundry_private.pos_g7_member_name(
 p_device_token text,p_login_token text,p_name_prefix text)
returns table(member_number bigint,display_name text)
language plpgsql security definer set search_path='' stable as $$
declare v_query text;
begin
 perform 1 from laundry_private.pos_g4_cashier_authorize(
   p_device_token,p_login_token,'member_lookup',false);
 v_query:=pg_catalog.btrim(coalesce(p_name_prefix,''));
 if pg_catalog.length(v_query) not between 3 and 60
    or v_query ~ '[[:cntrl:]]' then return;end if;
 return query
 select m.member_number,m.display_name
 from public.laundry_members m
 where m.is_active
   and pg_catalog.starts_with(pg_catalog.lower(m.display_name),pg_catalog.lower(v_query))
 order by pg_catalog.lower(m.display_name),m.member_number
 limit 8;
end; $$;
revoke all on function laundry_private.pos_g7_member_name(text,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g7_member_name(text,text,text) to anon,authenticated;
create function public.laundry_pos_g7_member_name(
 p_device_token text,p_login_token text,p_name_prefix text)
returns table(member_number bigint,display_name text)
language sql security invoker set search_path='' stable as $$
 select * from laundry_private.pos_g7_member_name(p_device_token,p_login_token,p_name_prefix);
$$;
revoke all on function public.laundry_pos_g7_member_name(text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g7_member_name(text,text,text) to anon,authenticated;
comment on function public.laundry_pos_g7_member_name(text,text,text) is
 'Bounded 3-60 chars prefix, max 8 active members, cashier permission member_lookup. Returns only name and member number; not phone, address, card or points.';