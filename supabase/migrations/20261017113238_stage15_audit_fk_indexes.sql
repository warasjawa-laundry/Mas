-- Audit maintenance: cover foreign keys and keep rule changes database-only.
-- Does not update members, transactions, point balances, or existing cards.
set lock_timeout = '5s';
set statement_timeout = '60s';

create index if not exists laundry_amount_transactions_actor_idx
  on public.laundry_amount_transactions(actor_id);
create index if not exists laundry_amount_transactions_year_idx
  on public.laundry_amount_transactions(program_year);
create index if not exists laundry_member_contact_events_actor_idx
  on public.laundry_member_contact_events(actor_id);
create index if not exists laundry_member_contact_events_member_idx
  on public.laundry_member_contact_events(member_id);
create index if not exists laundry_point_rules_updated_by_idx
  on public.laundry_point_rules(updated_by);

-- Customer Stage 9 databases do not yet have the QA-only reissue journal.
do $audit$
declare
  signature text;
begin
  if to_regclass('public.laundry_card_reissues') is not null then
    execute 'create index if not exists laundry_card_reissues_actor_idx on public.laundry_card_reissues(actor_id)';
    execute 'create index if not exists laundry_card_reissues_old_card_idx on public.laundry_card_reissues(old_card_id)';
  end if;
  -- Also harden pre-Stage-10 databases without enabling any Stage 10 feature.
  foreach signature in array array[
    'public.laundry_set_point_rules(integer,jsonb,integer)',
    'laundry_private.set_point_rules(integer,jsonb,integer)',
    'public.laundry_initialize_point_year(integer)',
    'laundry_private.initialize_point_year(integer)'
  ] loop
    if to_regprocedure(signature) is not null then
      execute format('revoke execute on function %s from public,anon,authenticated,service_role',signature);
    end if;
  end loop;
end
$audit$;
revoke insert,update,delete,truncate on public.laundry_point_rules
  from public,anon,authenticated,service_role;

reset lock_timeout;
reset statement_timeout;
