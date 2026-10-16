-- Stage 4: registration and QR lookup. No actual member data is seeded.
-- Security model: exposed functions run as INVOKER and forward to narrowly
-- authorized functions in a schema NOT exposed via Supabase Data API.
create schema if not exists laundry_private;
revoke all on schema laundry_private from public;
grant usage on schema laundry_private to authenticated, anon;

alter table public.laundry_members add column if not exists registration_request_id uuid unique;
comment on column public.laundry_members.registration_request_id is
  'A stable owner-submitted idempotency key. Duplicate submission returns the original member and card.';

create or replace function laundry_private.register_member(
  p_display_name text,
  p_whatsapp_e164 text,
  p_whatsapp_consent boolean,
  p_token_digest_hex text,
  p_token_ciphertext_hex text,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner uuid := auth.uid();
        v_member uuid;
        v_name text := btrim(p_display_name);
begin
  if v_owner is null or not exists (
    select 1 from public.laundry_owner_accounts
    where auth_user_id = v_owner and is_active
  ) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 100 then
    raise exception 'invalid_member_name' using errcode='22023';
  end if;
  if p_request_id is null
    or p_token_digest_hex is null or p_token_digest_hex !~ '^[0-9a-f]{64}$'
    or p_token_ciphertext_hex is null or p_token_ciphertext_hex !~ '^[0-9a-f]+$'
    or length(p_token_ciphertext_hex) < 56 or length(p_token_ciphertext_hex) > 4096
  then raise exception 'invalid_card_material' using errcode='22023';
  end if;
  if p_whatsapp_e164 is not null and p_whatsapp_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_whatsapp' using errcode='22023';
  end if;
  if coalesce(p_whatsapp_consent,false) and p_whatsapp_e164 is null then
    raise exception 'consent_requires_phone' using errcode='22023';
  end if;

  insert into public.laundry_members (
    display_name, whatsapp_e164, whatsapp_promo_consent, whatsapp_consent_at,
    created_by, registration_request_id
  ) values (
    v_name, p_whatsapp_e164, coalesce(p_whatsapp_consent,false),
    case when coalesce(p_whatsapp_consent,false) then now() else null end,
    v_owner, p_request_id
  )
  on conflict (registration_request_id) do nothing
  returning id into v_member;

  if v_member is null then
    select id into v_member from public.laundry_members
    where registration_request_id=p_request_id and created_by=v_owner;
    if v_member is null then
      raise exception 'registration_request_conflict' using errcode='23505';
    end if;
    return v_member;
  end if;

  insert into public.laundry_member_cards (member_id, token_digest, token_ciphertext, issued_by)
  values (v_member, decode(p_token_digest_hex,'hex'), decode(p_token_ciphertext_hex,'hex'), v_owner);
  return v_member;
end;
$$;
revoke all on function laundry_private.register_member(text,text,boolean,text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.register_member(text,text,boolean,text,text,uuid) to authenticated;

-- Public Data API wrapper; invokes the private routine using caller's JWT.
create or replace function public.laundry_register_member(
  p_display_name text, p_whatsapp_e164 text, p_whatsapp_consent boolean,
  p_token_digest_hex text, p_token_ciphertext_hex text, p_request_id uuid
) returns uuid
language sql security invoker set search_path = ''
as $$
  select laundry_private.register_member(
    p_display_name,p_whatsapp_e164,p_whatsapp_consent,
    p_token_digest_hex,p_token_ciphertext_hex,p_request_id
  );
$$;
revoke all on function public.laundry_register_member(text,text,boolean,text,text,uuid) from public,anon,authenticated;
grant execute on function public.laundry_register_member(text,text,boolean,text,text,uuid) to authenticated;

-- Owner-only active card material for reprinting. Never sent to a public URL.
create or replace function laundry_private.owner_card_material(p_member_id uuid)
returns table(member_number bigint, display_name text, token_ciphertext_hex text)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not exists (
   select 1 from public.laundry_owner_accounts
   where auth_user_id=auth.uid() and is_active
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 return query
 select m.member_number,m.display_name,encode(c.token_ciphertext,'hex')
 from public.laundry_members m
 join public.laundry_member_cards c on c.member_id=m.id
 where m.id=p_member_id and m.is_active and c.revoked_at is null;
end;
$$;
revoke all on function laundry_private.owner_card_material(uuid) from public,anon,authenticated;
grant execute on function laundry_private.owner_card_material(uuid) to authenticated;
create or replace function public.laundry_owner_card_material(p_member_id uuid)
returns table(member_number bigint, display_name text, token_ciphertext_hex text)
language sql security invoker set search_path=''
as $$ select * from laundry_private.owner_card_material(p_member_id); $$;
revoke all on function public.laundry_owner_card_material(uuid) from public,anon,authenticated;
grant execute on function public.laundry_owner_card_material(uuid) to authenticated;

-- Revoke owner card at any time. Re-issue implementation is deferred; revocation is permanent.
create or replace function laundry_private.revoke_card(p_member_id uuid,p_reason text)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_owner uuid := auth.uid();
begin
 if v_owner is null or not exists (
   select 1 from public.laundry_owner_accounts where auth_user_id=v_owner and is_active
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_reason,''))) not between 3 and 200 then
   raise exception 'invalid_reason' using errcode='22023'; end if;
 update public.laundry_member_cards
 set revoked_at=now(),revoked_by=v_owner,revoked_reason=btrim(p_reason)
 where member_id=p_member_id and revoked_at is null;
 return found;
end;
$$;
revoke all on function laundry_private.revoke_card(uuid,text) from public,anon,authenticated;
grant execute on function laundry_private.revoke_card(uuid,text) to authenticated;
create or replace function public.laundry_revoke_card(p_member_id uuid,p_reason text)
returns boolean language sql security invoker set search_path=''
as $$ select laundry_private.revoke_card(p_member_id,p_reason); $$;
revoke all on function public.laundry_revoke_card(uuid,text) from public,anon,authenticated;
grant execute on function public.laundry_revoke_card(uuid,text) to authenticated;

-- Public card progress returns deliberately limited, non-PII fields.
create or replace function laundry_private.public_card_progress(p_digest_hex text)
returns table(member_number bigint, visit_count bigint, promos jsonb)
language plpgsql security definer set search_path=''
as $$
begin
 if p_digest_hex is null or p_digest_hex !~ '^[0-9a-f]{64}$' then return; end if;
 return query
 select m.member_number,
   (select count(*)::bigint
      from public.laundry_checklist_events e
      where e.member_id=m.id and e.event_type='ADD'
        and not exists (
         select 1 from public.laundry_checklist_events void
         where void.reverses_event_id=e.id and void.event_type='VOID'
        )
   ),
   coalesce((
     select jsonb_agg(jsonb_build_object('title',p.title,'status',p.status))
     from public.laundry_member_promotions p
     where p.member_id=m.id and p.status='AVAILABLE'
       and (p.expires_at is null or p.expires_at > now())
   ),'[]'::jsonb)
 from public.laundry_member_cards c
 join public.laundry_members m on m.id=c.member_id
 where c.revoked_at is null and m.is_active
   and c.token_digest=decode(p_digest_hex,'hex');
end;
$$;
revoke all on function laundry_private.public_card_progress(text) from public,anon,authenticated;
grant execute on function laundry_private.public_card_progress(text) to anon,authenticated;
create or replace function public.laundry_public_card_progress(p_digest_hex text)
returns table(member_number bigint, visit_count bigint, promos jsonb)
language sql security invoker set search_path=''
as $$ select * from laundry_private.public_card_progress(p_digest_hex); $$;
revoke all on function public.laundry_public_card_progress(text) from public,anon,authenticated;
grant execute on function public.laundry_public_card_progress(text) to anon,authenticated;

comment on function public.laundry_public_card_progress(text) is
 'Opaque high-entropy bearer digest only. Return count, member number and manual available promos; no PII.';
