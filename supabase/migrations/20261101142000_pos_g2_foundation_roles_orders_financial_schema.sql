-- POS G2: additive schema, per-outlet authorization and financial journal contracts.
-- Do NOT apply to production before G2 approval and QA regression gate.
-- Existing membership/QR/points rows are not modified or copied.

create table public.laundry_pos_outlets (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z0-9]{2,8}$'),
 name text not null check (char_length(name) between 2 and 120),
 active boolean not null default false,
 write_enabled boolean not null default false,
 config_revision integer not null default 1 check (config_revision > 0),
 created_at timestamptz not null default clock_timestamp(),
 check (not write_enabled or active)
);

create table public.laundry_pos_staff (
 auth_user_id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null check (length(display_name) between 2 and 100),
 active boolean not null default false,
 created_at timestamptz not null default clock_timestamp()
);

create table public.laundry_pos_staff_outlets (
 auth_user_id uuid not null references public.laundry_pos_staff(auth_user_id) on delete restrict,
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 role text not null check (role in ('cashier','manager')),
 enabled boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 primary key (auth_user_id,outlet_id)
);
create index laundry_pos_staff_outlets_outlet_idx on public.laundry_pos_staff_outlets(outlet_id,enabled);

create table public.laundry_pos_guest_customers (
 id uuid primary key default gen_random_uuid(),
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 display_name text not null check (length(display_name) between 1 and 120),
 contact text check (contact is null or length(contact) between 4 and 60),
 linked_member_id uuid references public.laundry_members(id) on delete restrict,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 unique (id,outlet_id)
);

create table public.laundry_pos_invoice_counters (
 outlet_id uuid primary key references public.laundry_pos_outlets(id) on delete restrict,
 last_sequence bigint not null default 0 check (last_sequence >= 0)
);

create table public.laundry_pos_orders (
 id uuid primary key default gen_random_uuid(),
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 sequence_number bigint not null check (sequence_number > 0),
 invoice_no text not null unique check (length(invoice_no) between 8 and 70),
 member_id uuid references public.laundry_members(id) on delete restrict,
 guest_id uuid references public.laundry_pos_guest_customers(id) on delete restrict,
 customer_name text not null check (length(customer_name) between 1 and 120),
 lifecycle_status text not null default 'DRAFT' check (lifecycle_status in ('DRAFT','CONFIRMED','CANCELLED')),
 work_status text not null default 'QUEUED' check (work_status in ('QUEUED','READY','COLLECTED')),
 refund_status text not null default 'NONE' check (refund_status in ('NONE','PENDING','FULLY_REFUNDED')),
 service_subtotal_idr bigint not null check (service_subtotal_idr between 0 and 1000000000),
 discount_idr bigint not null default 0 check (discount_idr between 0 and 1000000000),
 fees_idr bigint not null default 0 check (fees_idr between 0 and 1000000000),
 total_idr bigint not null check (total_idr between 0 and 1000000000),
 catalog_revision bigint not null check (catalog_revision > 0),
 due_at timestamptz,
 perfume text check (perfume is null or length(perfume) <= 80),
 notes text check (notes is null or length(notes) <= 500),
 version bigint not null default 1 check (version > 0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 confirmed_at timestamptz,
 check ((member_id is not null) <> (guest_id is not null)),
 check (discount_idr <= service_subtotal_idr),
 check (total_idr = service_subtotal_idr - discount_idr + fees_idr),
 unique (outlet_id,sequence_number),
 unique (id,outlet_id),
 unique (id,member_id),
 foreign key (guest_id,outlet_id) references public.laundry_pos_guest_customers(id,outlet_id) on delete restrict
);
create index laundry_pos_orders_work_idx on public.laundry_pos_orders(outlet_id,work_status,created_at desc);
create index laundry_pos_orders_member_idx on public.laundry_pos_orders(member_id,created_at desc);
create index laundry_pos_orders_created_idx on public.laundry_pos_orders(outlet_id,created_at desc);

create table public.laundry_pos_order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.laundry_pos_orders(id) on delete restrict,
 service_id uuid references public.laundry_services(id) on delete restrict,
 line_number integer not null check (line_number between 1 and 1000),
 service_name text not null check (length(service_name) between 1 and 120),
 unit text not null check (unit in ('kg','m','pcs')),
 quantity_milli bigint not null check (quantity_milli between 1 and 1000000000),
 price_idr bigint not null check (price_idr between 0 and 1000000000),
 line_total_idr bigint not null check (line_total_idr between 0 and 1000000000),
 duration_hours integer check (duration_hours is null or duration_hours between 1 and 8760),
 unique (order_id,line_number),
 check (unit <> 'pcs' or quantity_milli % 1000 = 0),
 check (line_total_idr = (price_idr * quantity_milli + 500) / 1000)
);

create table public.laundry_pos_order_adjustments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.laundry_pos_orders(id) on delete restrict,
 kind text not null check (kind in ('DISCOUNT_FIXED','DISCOUNT_PERCENT','DELIVERY','SERVICE_FEE')),
 amount_idr bigint not null check (amount_idr between 0 and 1000000000),
 basis_points integer check (basis_points is null or basis_points between 0 and 10000),
 reason text check (reason is null or length(reason) between 3 and 300),
 authorized_by uuid references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 check ((kind = 'DISCOUNT_PERCENT') = (basis_points is not null))
);

create table public.laundry_pos_commands (
 request_id uuid primary key,
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 operation text not null check (operation in ('CREATE_ORDER','PAYMENT','SET_WORK','CANCEL','FULL_REFUND','OPEN_SHIFT','CLOSE_SHIFT','CASH_ENTRY')),
 target_id uuid,
 payload_digest bytea not null check (octet_length(payload_digest)=32),
 result jsonb not null check (jsonb_typeof(result)='object'),
 committed_at timestamptz not null default clock_timestamp(),
 unique (request_id,outlet_id)
);
create index laundry_pos_commands_actor_idx on public.laundry_pos_commands(actor_id,committed_at desc);

create table public.laundry_pos_cash_shifts (
 id uuid primary key default gen_random_uuid(),
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 register_code text not null check (register_code ~ '^[A-Z0-9_-]{1,32}$'),
 opened_by uuid not null references auth.users(id),
 opened_at timestamptz not null default clock_timestamp(),
 opening_idr bigint not null default 0 check (opening_idr between 0 and 1000000000),
 closed_by uuid references auth.users(id),
 closed_at timestamptz,
 counted_idr bigint check (counted_idr is null or counted_idr between 0 and 1000000000),
 discrepancy_idr bigint,
 check ((closed_at is null and closed_by is null and counted_idr is null and discrepancy_idr is null)
        or (closed_at is not null and closed_by is not null and counted_idr is not null and discrepancy_idr is not null)),
 check (closed_at is null or closed_at >= opened_at),
 unique (id,outlet_id)
);
create unique index laundry_pos_cash_shifts_one_open on public.laundry_pos_cash_shifts(outlet_id,register_code) where closed_at is null;

create table public.laundry_pos_payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null,
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 command_id uuid not null,
 shift_id uuid not null,
 entry_type text not null check (entry_type in ('RECEIPT','REFUND')),
 original_receipt_id uuid references public.laundry_pos_payments(id) on delete restrict,
 method text not null check (method in ('CASH','NONCASH')),
 amount_idr bigint not null check (amount_idr between 1 and 1000000000),
 confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null default clock_timestamp(),
 check ((entry_type='RECEIPT')=(original_receipt_id is null)),
 foreign key (order_id,outlet_id) references public.laundry_pos_orders(id,outlet_id) on delete restrict,
 foreign key (command_id,outlet_id) references public.laundry_pos_commands(request_id,outlet_id) on delete restrict,
 foreign key (shift_id,outlet_id) references public.laundry_pos_cash_shifts(id,outlet_id) on delete restrict
);
create unique index laundry_pos_payments_one_receipt_cmd on public.laundry_pos_payments(command_id) where entry_type='RECEIPT';
create unique index laundry_pos_payments_refund_source_cmd on public.laundry_pos_payments(command_id,original_receipt_id) where entry_type='REFUND';
create index laundry_pos_payments_order_idx on public.laundry_pos_payments(order_id,confirmed_at desc);
create index laundry_pos_payments_shift_idx on public.laundry_pos_payments(shift_id,confirmed_at desc);

create table public.laundry_pos_cash_ledger (
 id uuid primary key default gen_random_uuid(),
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 shift_id uuid not null,
 payment_id uuid unique references public.laundry_pos_payments(id) on delete restrict,
 command_id uuid not null references public.laundry_pos_commands(request_id) on delete restrict,
 direction text not null check (direction in ('IN','OUT')),
 method text not null check (method in ('CASH','NONCASH')),
 amount_idr bigint not null check (amount_idr between 1 and 1000000000),
 category text not null check (category in ('PAYMENT','REFUND','NON_SALE_IN','NON_SALE_OUT')),
 note text check (note is null or length(note) between 3 and 300),
 created_by uuid not null references auth.users(id),
 occurred_at timestamptz not null default clock_timestamp(),
 foreign key (shift_id,outlet_id) references public.laundry_pos_cash_shifts(id,outlet_id) on delete restrict,
 foreign key (command_id,outlet_id) references public.laundry_pos_commands(request_id,outlet_id) on delete restrict,
 check ((category in ('PAYMENT','REFUND'))=(payment_id is not null)),
 check ((category in ('PAYMENT','NON_SALE_IN'))=(direction='IN'))
);
create unique index laundry_pos_cash_one_non_sale_cmd on public.laundry_pos_cash_ledger(command_id) where category in ('NON_SALE_IN','NON_SALE_OUT');
create index laundry_pos_cash_ledger_shift_idx on public.laundry_pos_cash_ledger(shift_id,occurred_at desc);

create table public.laundry_pos_order_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.laundry_pos_orders(id) on delete restrict,
 command_id uuid not null references public.laundry_pos_commands(request_id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 kind text not null check (length(kind) between 3 and 50),
 reason text check (reason is null or length(reason) between 3 and 500),
 data jsonb not null default '{}'::jsonb check (jsonb_typeof(data)='object'),
 occurred_at timestamptz not null default clock_timestamp(),
 unique (command_id,kind)
);
create index laundry_pos_order_events_order_idx on public.laundry_pos_order_events(order_id,occurred_at desc);

create table public.laundry_pos_point_links (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.laundry_pos_orders(id) on delete restrict,
 award_cycle integer not null default 1 check (award_cycle >= 1),
 link_type text not null check (link_type in ('ADD','VOID')),
 event_id uuid not null unique references public.laundry_checklist_events(id) on delete restrict,
 member_id uuid not null references public.laundry_members(id) on delete restrict,
 program_year integer not null references public.laundry_point_rules(program_year),
 amount_idr bigint not null check (amount_idr between 0 and 1000000000),
 awarded_points integer not null check (awarded_points between 0 and 10000),
 rule_revision integer not null check (rule_revision >= 1),
 command_id uuid not null references public.laundry_pos_commands(request_id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 unique (order_id,award_cycle,link_type),
 foreign key (order_id,member_id) references public.laundry_pos_orders(id,member_id) on delete restrict
);
create index laundry_pos_point_links_member_idx on public.laundry_pos_point_links(member_id,program_year);

create table public.laundry_pos_import_batches (
 id uuid primary key default gen_random_uuid(),
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 source_system text not null check (length(source_system) between 2 and 60),
 file_sha256 bytea not null check (octet_length(file_sha256)=32),
 imported_by uuid not null references auth.users(id),
 received_at timestamptz not null default clock_timestamp(),
 source_period_start date,
 source_period_end date,
 status text not null default 'PREVIEW' check (status in ('PREVIEW','REVIEWED','QUARANTINED','ARCHIVED')),
 check (source_period_end is null or source_period_start is not null),
 check (source_period_end is null or source_period_end >= source_period_start),
 unique (outlet_id,source_system,file_sha256)
);

create table public.laundry_pos_import_rows (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.laundry_pos_import_batches(id) on delete restrict,
 row_number integer not null check (row_number > 0),
 row_sha256 bytea not null check (octet_length(row_sha256)=32),
 external_invoice text not null check (length(external_invoice) between 1 and 100),
 parsed_status text not null check (parsed_status in ('PAID','PARTIAL','UNPAID','UNKNOWN')),
 match_member_id uuid references public.laundry_members(id),
 review_status text not null default 'PENDING' check (review_status in ('PENDING','MATCHED','CONFLICT','SKIPPED')),
 raw_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_snapshot)='object'),
 unique (batch_id,row_number)
);

create table public.laundry_pos_legacy_reconciliation (
 legacy_event_id uuid primary key references public.laundry_checklist_events(id) on delete restrict,
 outlet_id uuid references public.laundry_pos_outlets(id) on delete restrict,
 source_invoice text check (source_invoice is null or length(source_invoice) between 1 and 100),
 reviewed_by uuid not null references auth.users(id) on delete restrict,
 reviewed_at timestamptz not null default clock_timestamp(),
 reason text not null check (length(reason) between 3 and 500)
);

-- The only permitted mutations for financial rows will be INSERT via vetted RPCs.
-- Bypass-RLS DB administrators still cannot UPDATE/DELETE these journals accidentally.
create function laundry_private.pos_reject_journal_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
 raise exception 'immutable_pos_journal' using errcode='42501';
end;
$$;
revoke all on function laundry_private.pos_reject_journal_changes() from public, anon, authenticated;

-- Immutable financial and event history; order state and staff provisioning have
-- their own future reviewed commands, not raw client writes.
create trigger pos_payments_immutable before update or delete on public.laundry_pos_payments
for each row execute function laundry_private.pos_reject_journal_changes();
create trigger pos_ledger_immutable before update or delete on public.laundry_pos_cash_ledger
for each row execute function laundry_private.pos_reject_journal_changes();
create trigger pos_point_links_immutable before update or delete on public.laundry_pos_point_links
for each row execute function laundry_private.pos_reject_journal_changes();
create trigger pos_order_events_immutable before update or delete on public.laundry_pos_order_events
for each row execute function laundry_private.pos_reject_journal_changes();
create trigger pos_commands_immutable before update or delete on public.laundry_pos_commands
for each row execute function laundry_private.pos_reject_journal_changes();

-- Strong default deny. No client-facing table grants: scoped read and financial
-- writes must be exposed through individually authorized RPCs in later gates.
do $$
declare n text;
begin
 foreach n in array array[
 'laundry_pos_outlets','laundry_pos_staff','laundry_pos_staff_outlets',
 'laundry_pos_guest_customers','laundry_pos_invoice_counters','laundry_pos_orders',
 'laundry_pos_order_items','laundry_pos_order_adjustments','laundry_pos_commands',
 'laundry_pos_cash_shifts','laundry_pos_payments','laundry_pos_cash_ledger',
 'laundry_pos_order_events','laundry_pos_point_links','laundry_pos_import_batches',
 'laundry_pos_import_rows','laundry_pos_legacy_reconciliation']
 loop
  execute format('alter table public.%I enable row level security', n);
  execute format('revoke all on table public.%I from public, anon, authenticated', n);
 end loop;
end $$;

-- Read-only, minimal staff/outlet availability. Owner can list every active
-- outlet; cashiers only their enabled outlet. None can query PII by this RPC.
create function laundry_private.pos_authorized_outlets()
returns table (outlet_id uuid, outlet_code text, outlet_name text, assigned_role text)
language sql security definer set search_path = '' stable
as $$
 select o.id, o.code, o.name,
        case when own.auth_user_id is not null then 'owner'::text else so.role end
 from public.laundry_pos_outlets o
 left join public.laundry_owner_accounts own
   on own.auth_user_id = (select auth.uid()) and own.is_active
 left join public.laundry_pos_staff st
   on st.auth_user_id = (select auth.uid()) and st.active
 left join public.laundry_pos_staff_outlets so
   on so.auth_user_id = st.auth_user_id and so.outlet_id = o.id and so.enabled
 where (select auth.uid()) is not null and o.active
   and (own.auth_user_id is not null or (st.auth_user_id is not null and so.auth_user_id is not null));
$$;
revoke all on function laundry_private.pos_authorized_outlets() from public,anon,authenticated;
grant execute on function laundry_private.pos_authorized_outlets() to authenticated;
create function public.laundry_pos_authorized_outlets()
returns table (outlet_id uuid, outlet_code text, outlet_name text, assigned_role text)
language sql security invoker set search_path = '' stable
as $$ select * from laundry_private.pos_authorized_outlets(); $$;
revoke all on function public.laundry_pos_authorized_outlets() from public,anon,authenticated;
grant execute on function public.laundry_pos_authorized_outlets() to authenticated;

-- Existing owner-only RPCs and their permission checks are untouched.
-- G2 compatibility: actual point actors are auth.users; do not add cashiers to
-- laundry_owner_accounts. The existing checklist FK to owner accounts must be
-- widened without changing historic actor identifiers or granting DML.
alter table public.laundry_checklist_events
 drop constraint laundry_checklist_events_actor_id_fkey;
alter table public.laundry_checklist_events
 add constraint laundry_checklist_events_actor_id_fkey
 foreign key (actor_id) references auth.users(id) on delete restrict;

comment on function public.laundry_pos_authorized_outlets() is
 'POS G2 scoped, read-only outlet names and role. No cashier financial permissions or customer data.';