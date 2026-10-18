-- Explicitly requested member name, scoped by the same active QR capability.
create or replace function laundry_private.public_member_name(p_digest_hex text)
returns text language plpgsql stable security definer set search_path=''
as $$
declare v_name text;
begin
 if p_digest_hex is null or p_digest_hex !~ '^[0-9a-f]{64}$' then return null;end if;
 select m.display_name into v_name from public.laundry_member_cards c
 join public.laundry_members m on m.id=c.member_id
 where c.token_digest=decode(p_digest_hex,'hex') and c.revoked_at is null and m.is_active;
 return v_name;
end;
$$;
revoke all on function laundry_private.public_member_name(text) from public,anon,authenticated;
grant execute on function laundry_private.public_member_name(text) to anon,authenticated;
create or replace function public.laundry_public_member_name(p_digest_hex text)
returns text language sql stable security invoker set search_path=''
as $$ select laundry_private.public_member_name(p_digest_hex); $$;
revoke all on function public.laundry_public_member_name(text) from public,anon,authenticated;
grant execute on function public.laundry_public_member_name(text) to anon,authenticated;
