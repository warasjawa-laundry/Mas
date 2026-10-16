-- Stage 9: owner-defined amount tiers; atomic amount visit; immutable point snapshot.
-- Year 2026 is a separate pre-launch/test ledger. 2027 is the video program year.
-- No automatic reward distribution or historical backfill.

create table if not exists public.laundry_point_rules (
  program_year integer primary key check (program_year between 2026 and 2100),
  tiers jsonb not null check (jsonb_typeof(tiers)='array' and jsonb_array_length(tiers)=5),
  revision integer not null default 1 check (revision>=1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.laundry_point_rules enable row level security;
revoke all on public.laundry_point_rules from public,anon,authenticated;
grant select on public.laundry_point_rules to authenticated;
drop policy if exists laundry_owner_read_point_rules on public.laundry_point_rules;
create policy laundry_owner_read_point_rules on public.laundry_point_rules for select to authenticated
 using (exists(select 1 from public.laundry_owner_accounts o
 where o.auth_user_id=(select auth.uid()) and o.is_active));

insert into public.laundry_point_rules(program_year,tiers)
values
(2026,'[{"minimum":10000,"points":1},{"minimum":25000,"points":3},{"minimum":50000,"points":5},{"minimum":100000,"points":10},{"minimum":200000,"points":20}]'::jsonb),
(2027,'[{"minimum":10000,"points":1},{"minimum":25000,"points":3},{"minimum":50000,"points":5},{"minimum":100000,"points":10},{"minimum":200000,"points":20}]'::jsonb)
on conflict (program_year) do nothing;

create table if not exists public.laundry_amount_transactions (
 visit_event_id uuid primary key references public.laundry_checklist_events(id) on delete restrict,
 member_id uuid not null references public.laundry_members(id),
 actor_id uuid not null references auth.users(id),
 amount_idr bigint not null check (amount_idr between 1 and 1000000000),
 description text not null check (length(description) between 3 and 240),
 program_year integer not null references public.laundry_point_rules(program_year),
 awarded_points integer not null check (awarded_points between 0 and 10000),
 rule_revision integer not null check (rule_revision>=1),
 occurred_at timestamptz not null default now()
);
create index if not exists laundry_amount_transactions_member_year
 on public.laundry_amount_transactions(member_id,program_year,occurred_at desc);
alter table public.laundry_amount_transactions enable row level security;
revoke all on public.laundry_amount_transactions from public,anon,authenticated;
grant select on public.laundry_amount_transactions to authenticated;
drop policy if exists laundry_owner_read_amount_transactions on public.laundry_amount_transactions;
create policy laundry_owner_read_amount_transactions on public.laundry_amount_transactions
for select to authenticated using (exists(select 1 from public.laundry_owner_accounts o
 where o.auth_user_id=(select auth.uid()) and o.is_active));

create or replace function laundry_private.set_point_rules(
 p_year integer,p_tiers jsonb,p_expected_revision integer
) returns integer language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();v_current integer;v_previous bigint:=-1;v_amount bigint;v_points integer;v_item jsonb;v_result jsonb:='[]'::jsonb;
begin
 if v_actor is null or not exists(select 1 from public.laundry_owner_accounts
 where auth_user_id=v_actor and is_active) then raise exception 'not_authorized' using errcode='42501';end if;
 if p_year is null or p_year not between 2026 and 2100 or p_expected_revision is null or p_expected_revision<1
 or p_tiers is null or jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers)<>5
 then raise exception 'invalid_rules' using errcode='22023';end if;
 for v_item in select value from jsonb_array_elements(p_tiers)
 loop
   if jsonb_typeof(v_item) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(v_item))<>2
     or not (v_item?'minimum' and v_item?'points')
     or jsonb_typeof(v_item->'minimum') is distinct from 'number'
     or jsonb_typeof(v_item->'points') is distinct from 'number'
     or v_item->>'minimum' !~ '^[0-9]{1,10}$'
     or v_item->>'points' !~ '^[0-9]{1,4}$'
   then raise exception 'invalid_tier' using errcode='22023';end if;
   v_amount:=(v_item->>'minimum')::bigint;
   v_points:=(v_item->>'points')::integer;
   if v_amount<=v_previous or v_amount>1000000000 or v_points>10000
   then raise exception 'invalid_tier_order_or_value' using errcode='22023';end if;
   v_previous:=v_amount;
   v_result:=v_result||jsonb_build_array(jsonb_build_object('minimum',v_amount,'points',v_points));
 end loop;

 select revision into v_current from public.laundry_point_rules where program_year=p_year for update;
 if not found then raise exception 'rules_not_found' using errcode='22023';end if;
 if v_current<>p_expected_revision then raise exception 'rules_modified_reload' using errcode='22023';end if;
 update public.laundry_point_rules
 set tiers=v_result, revision=revision+1,updated_at=clock_timestamp(),updated_by=v_actor
 where program_year=p_year returning revision into v_current;
 return v_current;
end;
$$;
revoke all on function laundry_private.set_point_rules(integer,jsonb,integer) from public,anon,authenticated;
grant execute on function laundry_private.set_point_rules(integer,jsonb,integer) to authenticated;
create or replace function public.laundry_set_point_rules(
 p_year integer,p_tiers jsonb,p_expected_revision integer
) returns integer language sql security invoker set search_path=''
as $$ select laundry_private.set_point_rules(p_year,p_tiers,p_expected_revision); $$;
revoke all on function public.laundry_set_point_rules(integer,jsonb,integer) from public,anon,authenticated;
grant execute on function public.laundry_set_point_rules(integer,jsonb,integer) to authenticated;

create or replace function laundry_private.record_amount_visit(
 p_member_id uuid,p_amount_idr bigint,p_description text,p_request_id uuid
) returns table(event_id uuid,current_total bigint,points_awarded integer,points_total bigint,program_year integer)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_note text:=btrim(coalesce(p_description,''));
  v_year integer:=extract(year from timezone('Asia/Jakarta',now()))::integer;
  v_event uuid; v_total bigint; v_points integer:=0; v_revision integer; v_tiers jsonb;
  v_existing public.laundry_amount_transactions%rowtype; v_item jsonb;
begin
 if v_actor is null or not exists(select 1 from public.laundry_owner_accounts
 where auth_user_id=v_actor and is_active) then raise exception 'not_authorized' using errcode='42501';end if;
 if p_member_id is null or p_request_id is null or p_amount_idr is null
 or p_amount_idr not between 1 and 1000000000
 or length(v_note) not between 3 and 240 or v_note ~ '[[:cntrl:]]'
 then raise exception 'invalid_amount_transaction' using errcode='22023';end if;

 -- Snapshot the current rule under a shared row lock. Rule edits take an exclusive row lock.
 select r.tiers,r.revision into v_tiers,v_revision from public.laundry_point_rules r
 where r.program_year=v_year for share;
 if not found then raise exception 'point_year_not_configured' using errcode='22023';end if;

 -- The checklist ADD and amount/point snapshot live in the SAME SQL transaction.
 select e.event_id,e.current_total into v_event,v_total
 from laundry_private.record_visit(p_member_id,p_request_id) e;
 select * into v_existing from public.laundry_amount_transactions t where t.visit_event_id=v_event;
 if found then
   if v_existing.member_id is distinct from p_member_id
     or v_existing.actor_id is distinct from v_actor
     or v_existing.amount_idr is distinct from p_amount_idr
     or v_existing.description is distinct from v_note
   then raise exception 'idempotency_key_conflict' using errcode='23505';end if;
   v_points:=v_existing.awarded_points;
   v_year:=v_existing.program_year;
 else
   for v_item in select value from jsonb_array_elements(v_tiers) order by (value->>'minimum')::bigint
   loop
     if p_amount_idr >= (v_item->>'minimum')::bigint then
       v_points:=(v_item->>'points')::integer;
     end if;
   end loop;
   insert into public.laundry_amount_transactions
     (visit_event_id,member_id,actor_id,amount_idr,description,program_year,awarded_points,rule_revision)
   values(v_event,p_member_id,v_actor,p_amount_idr,v_note,v_year,v_points,v_revision);
 end if;

 return query
 select v_event,v_total,v_points,
   coalesce((select sum(t.awarded_points)::bigint
     from public.laundry_amount_transactions t
     where t.member_id=p_member_id and t.program_year=v_year and not exists(
       select 1 from public.laundry_checklist_events reversal
       where reversal.reverses_event_id=t.visit_event_id and reversal.event_type='VOID'
     )),0::bigint),v_year;
end;
$$;
revoke all on function laundry_private.record_amount_visit(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.record_amount_visit(uuid,bigint,text,uuid) to authenticated;
create or replace function public.laundry_record_amount_visit(
 p_member_id uuid,p_amount_idr bigint,p_description text,p_request_id uuid
) returns table(event_id uuid,current_total bigint,points_awarded integer,points_total bigint,program_year integer)
language sql security invoker set search_path=''
as $$ select * from laundry_private.record_amount_visit(p_member_id,p_amount_idr,p_description,p_request_id); $$;
revoke all on function public.laundry_record_amount_visit(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.laundry_record_amount_visit(uuid,bigint,text,uuid) to authenticated;

create or replace function laundry_private.public_point_balances(p_digest_hex text)
returns table(program_year integer,points_total bigint,point_transactions bigint)
language plpgsql security definer set search_path=''
as $
begin
 if p_digest_hex is null or p_digest_hex !~ '^[0-9a-f]{64}
   coalesce(sum(t.awarded_points) filter(where t.visit_event_id is not null),0)::bigint,
   count(t.visit_event_id)::bigint
 from public.laundry_member_cards c
 join public.laundry_members m on m.id=c.member_id
 cross join public.laundry_point_rules r
 left join public.laundry_amount_transactions t on t.member_id=m.id and t.program_year=r.program_year
  and not exists(select 1 from public.laundry_checklist_events rev
    where rev.reverses_event_id=t.visit_event_id and rev.event_type='VOID')
 where c.token_digest=decode(p_digest_hex,'hex') and c.revoked_at is null and m.is_active
 group by r.program_year
 order by r.program_year desc;
end;
$;
revoke all on function laundry_private.public_point_balances(text) from public,anon,authenticated;
grant execute on function laundry_private.public_point_balances(text) to anon,authenticated;
create or replace function public.laundry_public_point_balances(p_digest_hex text)
returns table(program_year integer,points_total bigint,point_transactions bigint)
language sql security invoker set search_path=''
as $$ select * from laundry_private.public_point_balances(p_digest_hex); $$;
revoke all on function public.laundry_public_point_balances(text) from public,anon,authenticated;
grant execute on function public.laundry_public_point_balances(text) to anon,authenticated;

comment on function public.laundry_record_amount_visit(uuid,bigint,text,uuid) is
 'Explicit owner action: one checklist ADD + amount and points snapshot, idempotent. VOID excludes points from balance.';
comment on function public.laundry_set_point_rules(integer,jsonb,integer) is
 'Owner-only future tier changes with optimistic revision; prior transactions retain awarded points.';
 then return; end if;
 return query
 select r.program_year,
   coalesce(sum(t.awarded_points) filter(where t.visit_event_id is not null),0)::bigint,
   count(t.visit_event_id)::bigint
 from public.laundry_member_cards c
 join public.laundry_members m on m.id=c.member_id
 cross join public.laundry_point_rules r
 left join public.laundry_amount_transactions t on t.member_id=m.id and t.program_year=r.program_year
  and not exists(select 1 from public.laundry_checklist_events rev
    where rev.reverses_event_id=t.visit_event_id and rev.event_type='VOID')
 where c.token_digest=decode(p_digest_hex,'hex') and c.revoked_at is null and m.is_active
  and p_digest_hex ~ '^[a-f0-9]{64}$'
 group by r.program_year
 order by r.program_year desc;
$$;
revoke all on function laundry_private.public_point_balances(text) from public,anon,authenticated;
grant execute on function laundry_private.public_point_balances(text) to anon,authenticated;
create or replace function public.laundry_public_point_balances(p_digest_hex text)
returns table(program_year integer,points_total bigint,point_transactions bigint)
language sql security invoker set search_path=''
as $$ select * from laundry_private.public_point_balances(p_digest_hex); $$;
revoke all on function public.laundry_public_point_balances(text) from public,anon,authenticated;
grant execute on function public.laundry_public_point_balances(text) to anon,authenticated;

comment on function public.laundry_record_amount_visit(uuid,bigint,text,uuid) is
 'Explicit owner action: one checklist ADD + amount and points snapshot, idempotent. VOID excludes points from balance.';
comment on function public.laundry_set_point_rules(integer,jsonb,integer) is
 'Owner-only future tier changes with optimistic revision; prior transactions retain awarded points.';
