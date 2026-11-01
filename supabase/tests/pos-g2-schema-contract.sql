-- G2 contracts after G3 username login: singleton outlet exists; regression runs in a rollback transaction.
begin;
set local statement_timeout='15s';
do $g2$
declare
 v_tables integer;
 v_rls integer;
 v_bad integer;
 v_outlet uuid;
 v_fk text;
 v_rows integer;
 v_role record;
 v_owner_fn integer;
begin
 select count(*),count(*) filter(where c.relrowsecurity)
 into v_tables,v_rls
 from pg_class c join pg_namespace n on c.relnamespace=n.oid
 where n.nspname='public' and c.relkind='r' and c.relname like 'laundry_pos_%';
 if v_tables<>20 or v_rls<>20 then raise exception 'G2 table/RLS count mismatch: %/%',v_tables,v_rls; end if;

 select count(*) into v_bad
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname like 'laundry_pos_%'
 and (has_table_privilege('anon',c.oid,'select') or has_table_privilege('anon',c.oid,'insert')
      or has_table_privilege('authenticated',c.oid,'select') or has_table_privilege('authenticated',c.oid,'insert')
      or has_table_privilege('authenticated',c.oid,'update') or has_table_privilege('authenticated',c.oid,'delete'));
 if v_bad<>0 then raise exception 'G2 direct table privilege leak %',v_bad; end if;

 select pg_get_constraintdef(c.oid) into v_fk from pg_constraint c
 where c.conrelid='public.laundry_checklist_events'::regclass and c.conname='laundry_checklist_events_actor_id_fkey';
 if v_fk not like '%REFERENCES auth.users(id)%' then raise exception 'G2 actor FK not compatible: %',v_fk; end if;

 if has_function_privilege('anon','public.laundry_pos_authorized_outlets()','execute')
 or not has_function_privilege('authenticated','public.laundry_pos_authorized_outlets()','execute')
 or has_function_privilege('anon','laundry_private.pos_authorized_outlets()','execute') then
  raise exception 'G2 public/anon function grant mismatch'; end if;
 if has_function_privilege('authenticated','laundry_private.pos_reject_journal_changes()','execute') then
  raise exception 'G2 trigger function grant mismatch'; end if;

 select count(*) into v_owner_fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('laundry_record_amount_visit','laundry_resolve_owner_card','laundry_void_visit');
 if v_owner_fn<>3 then raise exception 'G2 legacy functions missing'; end if;

 select count(*) into v_rows from public.laundry_pos_outlets;
 if v_rows<>1 then raise exception 'G2+G3 requires one fixed outlet'; end if;
 select id into v_outlet from public.laundry_pos_outlets where code='MJL' and active;
 if v_outlet is null or (select write_enabled from public.laundry_pos_outlets where id=v_outlet) then
  raise exception 'G3 fixed outlet missing or unexpectedly write-enabled'; end if;

 begin
  insert into public.laundry_pos_outlets(code,name,active,write_enabled) values('BADON','Rejected',false,true);
  raise exception 'G2 accepted impossible active/write setting';
 exception when check_violation then null; end;
 begin
  insert into public.laundry_pos_outlets(code,name) values('MJL','Duplicate outlet');
  raise exception 'G2 accepted duplicate outlet code';
 exception when unique_violation then null; end;
 begin
  insert into public.laundry_pos_outlets(code,name) values('lowercase','Rejected');
  raise exception 'G2 accepted invalid code';
 exception when check_violation then null; end;

 select count(*) into v_bad from pg_trigger t join pg_class c on c.oid=t.tgrelid
 join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 and c.relname in ('laundry_pos_payments','laundry_pos_cash_ledger','laundry_pos_point_links','laundry_pos_order_events','laundry_pos_commands')
 and t.tgenabled='O' and not t.tgisinternal;
 if v_bad<>5 then raise exception 'G2 immutable journal trigger count %',v_bad; end if;
end;
$g2$;
rollback;