-- Review is historical reconciliation only; no financial or point posting.
create table laundry_private.pos_import_review_audit(
 id uuid primary key default gen_random_uuid(),
 import_row_id uuid not null references public.laundry_pos_import_rows(id) on delete restrict,
 owner_id uuid not null references auth.users(id) on delete restrict,
 previous_status text not null,
 decision text not null check(decision in ('MATCHED','CONFLICT','SKIPPED')),
 member_id uuid references public.laundry_members(id) on delete restrict,
 reason text,
 occurred_at timestamptz not null default clock_timestamp()
);
create index pos_import_review_audit_row_idx on laundry_private.pos_import_review_audit(import_row_id,occurred_at);
alter table laundry_private.pos_import_review_audit enable row level security;
revoke all on laundry_private.pos_import_review_audit from public,anon,authenticated;

create function laundry_private.pos_import_review_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.parsed_status='PAID' and coalesce(new.raw_snapshot->>'status','') not in ('ANTRIAN','SIAP_AMBIL','SELESAI')
    and (tg_op='INSERT' or new.review_status='MATCHED') then
  raise exception 'POS_IMPORT_STATUS_UNVERIFIED' using errcode='22023';
 end if;
 if tg_op='UPDATE' and (new.batch_id,new.row_number,new.row_sha256,new.external_invoice,new.parsed_status,
    new.raw_snapshot,new.source_customer,new.source_total_idr,new.source_paid_idr) is distinct from
   (old.batch_id,old.row_number,old.row_sha256,old.external_invoice,old.parsed_status,
    old.raw_snapshot,old.source_customer,old.source_total_idr,old.source_paid_idr) then
  raise exception 'POS_IMPORT_SOURCE_IMMUTABLE' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function laundry_private.pos_import_review_guard() from public,anon,authenticated;
create trigger pos_import_review_guard before insert or update on public.laundry_pos_import_rows
 for each row execute function laundry_private.pos_import_review_guard();

create function laundry_private.pos_import_review_log()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if (new.review_status,new.match_member_id,new.review_reason) is not distinct from
    (old.review_status,old.match_member_id,old.review_reason) then return new;end if;
 actor:=laundry_private.pos_owner_required();
 if actor is distinct from new.reviewed_by then raise exception 'POS_REVIEW_ACTOR_INVALID' using errcode='42501';end if;
 insert into laundry_private.pos_import_review_audit(import_row_id,owner_id,previous_status,decision,member_id,reason)
 values(new.id,actor,old.review_status,new.review_status,new.match_member_id,new.review_reason);
 return new;
end; $$;
revoke all on function laundry_private.pos_import_review_log() from public,anon,authenticated;
create trigger pos_import_review_log after update on public.laundry_pos_import_rows
 for each row execute function laundry_private.pos_import_review_log();

create function laundry_private.pos_import_audit_immutable()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'POS_IMPORT_AUDIT_IMMUTABLE' using errcode='42501';end; $$;
revoke all on function laundry_private.pos_import_audit_immutable() from public,anon,authenticated;
create trigger pos_import_audit_immutable before update or delete on laundry_private.pos_import_review_audit
 for each row execute function laundry_private.pos_import_audit_immutable();
