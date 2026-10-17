-- Read-only verification, valid for both Stage 9 customer and Stage 11 QA.
do $audit$
begin
  if exists (
    select 1 from pg_constraint fk
    join pg_namespace ns on ns.oid=fk.connamespace
    where ns.nspname='public' and fk.contype='f'
      and fk.conname in (
        'laundry_amount_transactions_actor_id_fkey',
        'laundry_amount_transactions_program_year_fkey',
        'laundry_member_contact_events_actor_id_fkey',
        'laundry_member_contact_events_member_id_fkey',
        'laundry_point_rules_updated_by_fkey',
        'laundry_card_reissues_actor_id_fkey',
        'laundry_card_reissues_old_card_id_fkey'
      )
      and not exists (
        select 1 from pg_index idx
        where idx.indrelid=fk.conrelid and idx.indisvalid and idx.indisready
          and idx.indpred is null and idx.indexprs is null
          and (idx.indkey::smallint[])[0:cardinality(fk.conkey)-1] @> fk.conkey
      )
  ) then raise exception 'foreign_key_without_covering_index'; end if;
  if has_function_privilege('authenticated',
    'public.laundry_set_point_rules(integer,jsonb,integer)','EXECUTE')
    or has_function_privilege('authenticated',
    'laundry_private.set_point_rules(integer,jsonb,integer)','EXECUTE')
  then raise exception 'point_rules_still_editable'; end if;
  if not has_function_privilege('authenticated',
    'public.laundry_record_amount_visit(uuid,bigint,text,uuid)','EXECUTE')
  then raise exception 'amount_scoring_was_disabled'; end if;
end
$audit$;
select 'PASS: audited foreign keys indexed; rule writes denied; scoring available' as audit_result;
