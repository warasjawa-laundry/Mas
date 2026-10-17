-- Stage 10 (QA gated): atomic lost-card replacement and explicit next-year rule setup.
-- DO NOT apply to customer database before isolated integration & release approval.
-- No existing cards, point balances, or historic rules are modified by this migration.

create table if not exists public.laundry_card_reissues (
  request_id uuid primary key,
  member_id uuid not null references public.laundry_members(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  old_card_id uuid not null references public.laundry_member_cards(id) on delete restrict,
  new_card_id uuid not null unique references public.laundry_member_cards(id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 200),
  created_at timestamptz not null default now(),
  check (old_card_id <> new_card_id)
);
create index if not exists laundry_card_reissues_member_created_idx
  on public.laundry_card_reissues (member_id,created_at desc);
alter table public.laundry_card_reissues enable row level security;
-- Deliberately no direct SELECT/INSERT/UPDATE/DELETE grant or RLS policy.
-- Only the narrow definer function below may modify the audit journal.
revoke all on public.laundry_card_reissues from public,anon,authenticated;

create or replace function laundry_private.reissue_card(
  p_member_id uuid, p_reason text, p_token_digest_hex text,
  p_token_ciphertext_hex text, p_request_id uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason,''));
  v_locked_member uuid;
  v_previous_card uuid;
  v_card uuid;
  v_prior public.laundry_card_reissues%rowtype;
begin
  if v_actor is null or not exists(
    select 1 from public.laundry_owner_accounts o
    where o.auth_user_id=v_actor and o.is_active
  ) then raise exception 'not_authorized' using errcode='42501'; end if;

  if p_member_id is null or p_request_id is null
    or char_length(v_reason) not between 3 and 200
    or p_token_digest_hex is null or p_token_digest_hex !~ '^[0-9a-f]{64}$'
    or p_token_ciphertext_hex is null or p_token_ciphertext_hex !~ '^[0-9a-f]+$'
    or length(p_token_ciphertext_hex) < 56
    or length(p_token_ciphertext_hex) > 4096
  then raise exception 'invalid_card_reissue' using errcode='22023'; end if;

  -- Serialize all reissues of the same member, including concurrent retries.
  select m.id into v_locked_member
  from public.laundry_members m
  where m.id=p_member_id and m.is_active
  for update;
  if not found then raise exception 'member_not_active' using errcode='22023'; end if;

  -- A retry with the same UUID returns the original new card without reissuing.
  -- A request UUID may never be repurposed for a different member/owner/reason.
  select * into v_prior from public.laundry_card_reissues j
  where j.request_id=p_request_id;
  if found then
    if v_prior.member_id is distinct from p_member_id
       or v_prior.actor_id is distinct from v_actor
       or v_prior.reason is distinct from v_reason
    then raise exception 'idempotency_key_conflict' using errcode='23505'; end if;
    return v_prior.new_card_id;
  end if;

  select c.id into v_previous_card
  from public.laundry_member_cards c
  where c.member_id=p_member_id and c.revoked_at is null
  for update;
  if not found then raise exception 'active_card_not_found' using errcode='22023'; end if;

  update public.laundry_member_cards
  set revoked_at=clock_timestamp(),revoked_by=v_actor,revoked_reason=v_reason
  where id=v_previous_card and revoked_at is null;
  if not found then raise exception 'card_changed_retry' using errcode='40001'; end if;

  -- The existing unique partial index still permits only one active card/member.
  insert into public.laundry_member_cards
    (member_id,token_digest,token_ciphertext,issued_by)
  values(p_member_id,decode(p_token_digest_hex,'hex'),
         decode(p_token_ciphertext_hex,'hex'),v_actor)
  returning id into v_card;

  insert into public.laundry_card_reissues
    (request_id,member_id,actor_id,old_card_id,new_card_id,reason)
  values(p_request_id,p_member_id,v_actor,v_previous_card,v_card,v_reason);
  return v_card;
end;
$$;
revoke all on function laundry_private.reissue_card(uuid,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function laundry_private.reissue_card(uuid,text,text,text,uuid)
  to authenticated;

create or replace function public.laundry_reissue_card(
  p_member_id uuid, p_reason text, p_token_digest_hex text,
  p_token_ciphertext_hex text, p_request_id uuid
) returns uuid language sql security invoker set search_path=''
as $$ select laundry_private.reissue_card(
  p_member_id,p_reason,p_token_digest_hex,p_token_ciphertext_hex,p_request_id
); $$;
revoke all on function public.laundry_reissue_card(uuid,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.laundry_reissue_card(uuid,text,text,text,uuid)
  to authenticated;

-- Setup the next year's rules explicitly; existing historical ledgers are
-- immutable snapshots and MUST NOT be backfilled or overwritten.
create or replace function laundry_private.initialize_point_year(
  p_year integer
) returns boolean language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_current integer := extract(year from timezone('Asia/Jakarta',now()))::integer;
  v_source jsonb;
  v_inserted integer;
begin
  if v_actor is null or not exists(
    select 1 from public.laundry_owner_accounts o
    where o.auth_user_id=v_actor and o.is_active
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_year is null or p_year < 2027 or p_year > 2100
     or p_year not between v_current and v_current+1
  then raise exception 'year_not_permitted' using errcode='22023'; end if;

  -- Serializable with edits to prior-year thresholds: editor uses FOR UPDATE.
  select r.tiers into v_source
  from public.laundry_point_rules r where r.program_year=p_year-1
  for share;
  if not found then raise exception 'previous_year_rules_missing' using errcode='22023'; end if;

  insert into public.laundry_point_rules (program_year,tiers,updated_by)
  values (p_year,v_source,v_actor)
  on conflict(program_year) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted=1;
end;
$$;
revoke all on function laundry_private.initialize_point_year(integer)
  from public,anon,authenticated;
grant execute on function laundry_private.initialize_point_year(integer)
  to authenticated;

create or replace function public.laundry_initialize_point_year(
  p_year integer
) returns boolean language sql security invoker set search_path=''
as $$ select laundry_private.initialize_point_year(p_year); $$;
revoke all on function public.laundry_initialize_point_year(integer)
  from public,anon,authenticated;
grant execute on function public.laundry_initialize_point_year(integer)
  to authenticated;

comment on function public.laundry_reissue_card(uuid,text,text,text,uuid) is
  'Owner-only, explicit and idempotent card replacement. Revokes old card and issues new card in one SQL transaction.';
comment on function public.laundry_initialize_point_year(integer) is
  'Owner-only explicit next-year 5-tier rules bootstrap; copies last year only if target is absent.';
