-- Stage 3 / Mas Jawa Laundry: isolated membership foundation, no data migration.
-- Only the explicit service role can mutate business tables at this stage.
-- Anonymous customer progress MUST be implemented through a restricted server route;
-- never expose base tables or token material directly to anon.

create table public.laundry_owner_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_note text not null default 'Provisioned by administrator'
);

create table public.laundry_members (
  id uuid primary key default gen_random_uuid(),
  member_number bigint generated always as identity unique,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  whatsapp_e164 text check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_promo_consent boolean not null default false,
  whatsapp_consent_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.laundry_owner_accounts(auth_user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint laundry_member_consent_consistency check (
    (whatsapp_promo_consent = false and whatsapp_consent_at is null)
    or
    (whatsapp_promo_consent = true and whatsapp_e164 is not null and whatsapp_consent_at is not null)
  )
);

comment on column public.laundry_members.member_number is
  'Human-readable MJL-000001 is formatted in the UI; never use this sequential number to authorize access.';

create table public.laundry_member_cards (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.laundry_members(id) on delete restrict,
  token_digest bytea not null unique check (octet_length(token_digest) = 32),
  token_ciphertext bytea not null check (octet_length(token_ciphertext) >= 24),
  issued_by uuid not null references public.laundry_owner_accounts(auth_user_id),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.laundry_owner_accounts(auth_user_id),
  revoked_reason text,
  constraint laundry_card_revocation_consistency check (
    (revoked_at is null and revoked_by is null and revoked_reason is null)
    or
    (revoked_at is not null and revoked_by is not null and nullif(btrim(revoked_reason),'') is not null)
  )
);

comment on table public.laundry_member_cards is
  'Stores SHA-256 of high-entropy random QR bearer token and encrypted token for owner-authorized reprint; encryption key must remain server-only. Never expose base table to the browser.';

create unique index laundry_one_active_card_per_member
  on public.laundry_member_cards(member_id) where revoked_at is null;

create table public.laundry_checklist_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.laundry_members(id) on delete restrict,
  event_type text not null check (event_type in ('ADD','VOID')),
  reverses_event_id uuid references public.laundry_checklist_events(id) on delete restrict,
  reason text,
  request_id uuid not null unique,
  actor_id uuid not null references public.laundry_owner_accounts(auth_user_id),
  occurred_at timestamptz not null default now(),
  constraint laundry_checklist_event_shape check (
    (event_type = 'ADD' and reverses_event_id is null and reason is null)
    or
    (event_type = 'VOID' and reverses_event_id is not null and char_length(btrim(reason)) between 3 and 500)
  )
);

create unique index laundry_checklist_void_only_once
  on public.laundry_checklist_events(reverses_event_id) where event_type = 'VOID';
create index laundry_checklist_member_time
  on public.laundry_checklist_events(member_id, occurred_at desc);

create table public.laundry_member_promotions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.laundry_members(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  terms text check (terms is null or char_length(terms) <= 2000),
  expires_at timestamptz,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','USED','CANCELLED')),
  created_by uuid not null references public.laundry_owner_accounts(auth_user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references public.laundry_owner_accounts(auth_user_id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.laundry_owner_accounts(auth_user_id),
  cancel_reason text,
  request_id uuid not null unique,
  constraint laundry_promotion_state_valid check (
    (status = 'AVAILABLE' and redeemed_at is null and redeemed_by is null and cancelled_at is null and cancelled_by is null and cancel_reason is null)
    or (status = 'USED' and redeemed_at is not null and redeemed_by is not null and cancelled_at is null and cancelled_by is null and cancel_reason is null)
    or (status = 'CANCELLED' and redeemed_at is null and redeemed_by is null and cancelled_at is not null and cancelled_by is not null and char_length(btrim(cancel_reason)) between 3 and 500)
  )
);

create index laundry_promotions_member_status on public.laundry_member_promotions(member_id,status,created_at desc);

create table public.laundry_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.laundry_owner_accounts(auth_user_id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint laundry_audit_context_object check (jsonb_typeof(context) = 'object')
);
create index laundry_audit_entity_date on public.laundry_audit_events(entity_type,entity_id,created_at desc);

-- Maintain update timestamps. No client-provided timestamp can be trusted.
create function public.laundry_touch_timestamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger laundry_members_touch before update on public.laundry_members
  for each row execute function public.laundry_touch_timestamp();
create trigger laundry_promotions_touch before update on public.laundry_member_promotions
  for each row execute function public.laundry_touch_timestamp();

-- Immutable checklist/audit records: corrections append a VOID event, never rewrite history.
create function public.laundry_reject_immutable_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Immutable laundry ledger: append a correction instead' using errcode = '23514';
end;
$$;
create trigger laundry_checklist_immutable before update or delete on public.laundry_checklist_events
  for each row execute function public.laundry_reject_immutable_change();
create trigger laundry_audit_immutable before update or delete on public.laundry_audit_events
  for each row execute function public.laundry_reject_immutable_change();

-- VOID events must target an ADD from the same member, not a VOID or another member.
create function public.laundry_validate_void() returns trigger
language plpgsql set search_path = '' as $$
declare original record;
begin
  if new.event_type = 'VOID' then
    select e.member_id,e.event_type into original
      from public.laundry_checklist_events e where e.id = new.reverses_event_id;
    if not found or original.event_type <> 'ADD' or original.member_id <> new.member_id then
      raise exception 'VOID must reverse an ADD for the same member' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger laundry_void_check before insert on public.laundry_checklist_events
  for each row execute function public.laundry_validate_void();

-- Keep owner reward decisions manual: no trigger automatically awards a promotion.
create function public.laundry_validate_promotion_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.member_id is distinct from new.member_id
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at
     or old.request_id is distinct from new.request_id then
    raise exception 'Promotion ownership and creation identity cannot change' using errcode = '23514';
  end if;
  if old.status <> 'AVAILABLE' and old.status is distinct from new.status then
    raise exception 'Finalized promotion cannot change status' using errcode = '23514';
  end if;
  if old.status <> 'AVAILABLE' and (
    old.title is distinct from new.title or old.terms is distinct from new.terms
    or old.expires_at is distinct from new.expires_at
  ) then
    raise exception 'Finalized promotion cannot be edited' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger laundry_promotion_update_guard before update on public.laundry_member_promotions
  for each row execute function public.laundry_validate_promotion_update();

-- Audit server-created changes without ever copying names, phone numbers or QR token material.
create function public.laundry_log_activity() returns trigger
language plpgsql set search_path = '' as $$
declare actor uuid; entity uuid; operation text;
begin
  if tg_table_name = 'laundry_members' then
    actor := new.created_by; entity := new.id;
    operation := case when tg_op = 'INSERT' then 'MEMBER_CREATED' else 'MEMBER_UPDATED' end;
  elsif tg_table_name = 'laundry_member_cards' then
    actor := case when tg_op='INSERT' then new.issued_by else new.revoked_by end;
    entity := new.id;
    operation := case when tg_op = 'INSERT' then 'CARD_ISSUED' else 'CARD_UPDATED' end;
  elsif tg_table_name = 'laundry_checklist_events' then
    actor := new.actor_id; entity := new.id;
    operation := case when new.event_type='ADD' then 'VISIT_RECORDED' else 'VISIT_VOIDED' end;
  elsif tg_table_name = 'laundry_member_promotions' then
    actor := case when tg_op='INSERT' then new.created_by
       when new.status='USED' then new.redeemed_by
       when new.status='CANCELLED' then new.cancelled_by
       else new.created_by end;
    entity := new.id;
    operation := case when tg_op='INSERT' then 'PROMO_GRANTED'
      when new.status='USED' then 'PROMO_USED'
      when new.status='CANCELLED' then 'PROMO_CANCELLED'
      else 'PROMO_EDITED' end;
  else
    return new;
  end if;
  insert into public.laundry_audit_events(actor_id,entity_type,entity_id,action,context)
    values(actor,tg_table_name,entity,operation,'{}'::jsonb);
  return new;
end;
$$;

create trigger laundry_member_audit after insert or update on public.laundry_members
  for each row execute function public.laundry_log_activity();
create trigger laundry_card_audit after insert or update on public.laundry_member_cards
  for each row execute function public.laundry_log_activity();
create trigger laundry_checklist_audit after insert on public.laundry_checklist_events
  for each row execute function public.laundry_log_activity();
create trigger laundry_promotions_audit after insert or update on public.laundry_member_promotions
  for each row execute function public.laundry_log_activity();

-- Enable RLS on every exposed table before assigning minimal privileges.
alter table public.laundry_owner_accounts enable row level security;
alter table public.laundry_members enable row level security;
alter table public.laundry_member_cards enable row level security;
alter table public.laundry_checklist_events enable row level security;
alter table public.laundry_member_promotions enable row level security;
alter table public.laundry_audit_events enable row level security;

-- Clear permissive Supabase default API grants.
revoke all on public.laundry_owner_accounts, public.laundry_members,
  public.laundry_member_cards, public.laundry_checklist_events,
  public.laundry_member_promotions, public.laundry_audit_events
  from public, anon, authenticated;
revoke all on sequence public.laundry_members_member_number_seq from public, anon, authenticated;
revoke all on sequence public.laundry_audit_events_id_seq from public, anon, authenticated;

-- Owner can read only with valid Supabase Auth session and explicitly provisioned active owner role.
-- No anon SELECT, and authenticated cannot INSERT/UPDATE/DELETE any business table.
grant select on public.laundry_owner_accounts,public.laundry_members,
  public.laundry_checklist_events,public.laundry_member_promotions,
  public.laundry_audit_events to authenticated;

create policy laundry_owner_read_self on public.laundry_owner_accounts for select
  to authenticated using (auth_user_id = (select auth.uid()));

create policy laundry_owners_read_members on public.laundry_members for select
  to authenticated using (exists (
    select 1 from public.laundry_owner_accounts o
    where o.auth_user_id=(select auth.uid()) and o.is_active
  ));

create policy laundry_owners_read_checklists on public.laundry_checklist_events for select
  to authenticated using (exists (
    select 1 from public.laundry_owner_accounts o
    where o.auth_user_id=(select auth.uid()) and o.is_active
  ));

create policy laundry_owners_read_promotions on public.laundry_member_promotions for select
  to authenticated using (exists (
    select 1 from public.laundry_owner_accounts o
    where o.auth_user_id=(select auth.uid()) and o.is_active
  ));

create policy laundry_owners_read_audit on public.laundry_audit_events for select
  to authenticated using (exists (
    select 1 from public.laundry_owner_accounts o
    where o.auth_user_id=(select auth.uid()) and o.is_active
  ));

-- Trigger routines must not be reachable over the API. They are only for internal DML triggers.
revoke all on function public.laundry_touch_timestamp() from public, anon, authenticated;
revoke all on function public.laundry_reject_immutable_change() from public, anon, authenticated;
revoke all on function public.laundry_validate_void() from public, anon, authenticated;
revoke all on function public.laundry_validate_promotion_update() from public, anon, authenticated;
revoke all on function public.laundry_log_activity() from public, anon, authenticated;

comment on table public.laundry_checklist_events is
  'Event ledger: ADD or VOID only. Promo grants and redemption NEVER reset or decrement visits.';
comment on table public.laundry_member_promotions is
  'Owner-only manual awards independent of count. No automatic threshold, points or redemption from public QR.';

-- Owner provisioning intentionally omitted: create/invite an Auth user first,
-- then explicitly INSERT their known auth.users.id into laundry_owner_accounts
-- using administrator-controlled SQL, never by email alone or a client route.
