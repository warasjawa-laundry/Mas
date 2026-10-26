-- Stage 15 can precede the reissue table on existing operational databases.
-- Repair its skipped indexes after Stage 10, without replaying earlier migrations.
set lock_timeout = '5s';
set statement_timeout = '60s';

create index if not exists laundry_card_reissues_actor_idx
  on public.laundry_card_reissues(actor_id);
create index if not exists laundry_card_reissues_old_card_idx
  on public.laundry_card_reissues(old_card_id);

reset lock_timeout;
reset statement_timeout;
