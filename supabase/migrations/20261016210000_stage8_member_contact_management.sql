-- Stage 8: owner-only member profile/contact corrections and consent history.
-- Existing member ID/card, visits and promotions remain unchanged.
-- Never persist phone/name contents in audit history.

create table if not exists public.laundry_member_contact_events (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.laundry_members(id) on delete restrict,
  actor_id uuid not null references public.laundry_owner_accounts(auth_user_id),
  request_id uuid not null unique,
  action text not null check (action in ('UPDATED','UNCHANGED')),
  name_changed boolean not null,
  phone_changed boolean not null,
  consent_before boolean not null,
  consent_after boolean not null,
  created_at timestamptz not null default now()
);

alter table public.laundry_member_contact_events enable row level security;
revoke all on table public.laundry_member_contact_events from public,anon,authenticated;
grant select on table public.laundry_member_contact_events to authenticated;
drop policy if exists laundry_owner_read_contact_events on public.laundry_member_contact_events;
create policy laundry_owner_read_contact_events on public.laundry_member_contact_events
  for select to authenticated using (
    exists (select 1 from public.laundry_owner_accounts o
      where o.auth_user_id=(select auth.uid()) and o.is_active)
  );

create or replace function laundry_private.update_member_contact(
  p_member_id uuid,p_name text,p_whatsapp_e164 text,p_consent_action text,
  p_customer_confirmed boolean,p_expected_updated_at timestamptz,p_request_id uuid
) returns text language plpgsql security definer set search_path=''
as $$
declare
 v_owner uuid:=auth.uid();
 v_member public.laundry_members%rowtype;
 v_name text:=btrim(coalesce(p_name,''));
 v_phone text:=nullif(btrim(coalesce(p_whatsapp_e164,'')),'');
 v_action text:=upper(btrim(coalesce(p_consent_action,'')));
 v_old boolean;
 v_new boolean;
 v_consent_at timestamptz;
 v_phone_changed boolean;
 v_name_changed boolean;
 v_history public.laundry_member_contact_events%rowtype;
 v_result text;
begin
 if v_owner is null or not exists (
   select 1 from public.laundry_owner_accounts
   where auth_user_id=v_owner and is_active
 ) then raise exception 'not_authorized' using errcode='42501'; end if;

 if p_member_id is null or p_request_id is null or p_expected_updated_at is null
    or char_length(v_name) not between 2 and 100
    or v_name ~ '[[:cntrl:]]'
    or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$')
    or v_action not in ('KEEP','GRANT','REVOKE')
 then raise exception 'invalid_contact' using errcode='22023'; end if;
 if v_action='GRANT' and (v_phone is null or p_customer_confirmed is distinct from true)
 then raise exception 'consent_requires_confirmation_and_phone' using errcode='22023'; end if;

 -- A repeated request never performs a second write, even with stale revision.
 select * into v_history from public.laundry_member_contact_events where request_id=p_request_id;
 if found then
   if v_history.member_id is distinct from p_member_id or v_history.actor_id is distinct from v_owner
   then raise exception 'idempotency_key_conflict' using errcode='23505'; end if;
   return v_history.action;
 end if;

 select * into v_member from public.laundry_members
 where id=p_member_id and is_active for update;
 if not found then raise exception 'member_not_active' using errcode='22023'; end if;

 -- After row lock, re-check for concurrent duplicate submitted request.
 select * into v_history from public.laundry_member_contact_events where request_id=p_request_id;
 if found then
   if v_history.member_id is distinct from p_member_id or v_history.actor_id is distinct from v_owner
   then raise exception 'idempotency_key_conflict' using errcode='23505'; end if;
   return v_history.action;
 end if;

 if v_member.updated_at is distinct from p_expected_updated_at
 then raise exception 'member_modified_reload' using errcode='22023'; end if;

 v_phone_changed:=v_member.whatsapp_e164 is distinct from v_phone;
 v_name_changed:=v_member.display_name is distinct from v_name;
 v_old:=v_member.whatsapp_promo_consent;
 if v_action='GRANT' then
    v_new:=true;
    -- Explicit recorded confirmation, including re-confirmation on changed phone.
    v_consent_at:=clock_timestamp();
 elsif v_action='REVOKE' or v_phone is null or v_phone_changed then
    v_new:=false;
    v_consent_at:=null;
 else
    v_new:=v_old;
    v_consent_at:=v_member.whatsapp_consent_at;
 end if;

 if v_name_changed or v_phone_changed or v_new is distinct from v_old
    or v_consent_at is distinct from v_member.whatsapp_consent_at
 then
    update public.laundry_members
      set display_name=v_name,whatsapp_e164=v_phone,
        whatsapp_promo_consent=v_new,whatsapp_consent_at=v_consent_at
    where id=p_member_id;
    v_result:='UPDATED';
 else
    v_result:='UNCHANGED';
 end if;

 insert into public.laundry_member_contact_events(
   member_id,actor_id,request_id,action,name_changed,phone_changed,
   consent_before,consent_after
 ) values (
   p_member_id,v_owner,p_request_id,v_result,v_name_changed,v_phone_changed,v_old,v_new
 );
 return v_result;
end;
$$;
revoke all on function laundry_private.update_member_contact(uuid,text,text,text,boolean,timestamptz,uuid) from public,anon,authenticated;
grant execute on function laundry_private.update_member_contact(uuid,text,text,text,boolean,timestamptz,uuid) to authenticated;

create or replace function public.laundry_update_member_contact(
  p_member_id uuid,p_name text,p_whatsapp_e164 text,p_consent_action text,
  p_customer_confirmed boolean,p_expected_updated_at timestamptz,p_request_id uuid
) returns text language sql security invoker set search_path=''
as $$ select laundry_private.update_member_contact(
 p_member_id,p_name,p_whatsapp_e164,p_consent_action,p_customer_confirmed,
 p_expected_updated_at,p_request_id
); $$;
revoke all on function public.laundry_update_member_contact(uuid,text,text,text,boolean,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.laundry_update_member_contact(uuid,text,text,text,boolean,timestamptz,uuid) to authenticated;

comment on function public.laundry_update_member_contact(uuid,text,text,text,boolean,timestamptz,uuid) is
 'Owner-only, optimistic and idempotent member editing; consent requires explicit customer confirmation and resets on phone changes.';
