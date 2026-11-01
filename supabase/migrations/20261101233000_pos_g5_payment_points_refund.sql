-- Mas Jawa Laundry G5: synthetic-QA-tested payment, cash and point posting.
-- Not applied to production. Requires G2/G3/G4 migrations in order.
-- No owner credentials are borrowed for cashier events: all POS postings carry
-- their actual staff_id and legacy owner entries retain their auth_user actor.

-- Preserve legacy history verbatim while allowing individual staff attribution.
alter table public.laundry_checklist_events alter column actor_id drop not null;
alter table public.laundry_checklist_events
 add column actor_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_checklist_events
 add constraint pos_checklist_one_actor check ((actor_id is null) <> (actor_staff_id is null));
create index pos_checklist_staff_idx on public.laundry_checklist_events(actor_staff_id,occurred_at desc);
alter table public.laundry_amount_transactions alter column actor_id drop not null;
alter table public.laundry_amount_transactions
 add column actor_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_amount_transactions
 add constraint pos_amount_one_actor check ((actor_id is null) <> (actor_staff_id is null));
create index pos_amount_staff_idx on public.laundry_amount_transactions(actor_staff_id,occurred_at desc);

alter table public.laundry_pos_payments alter column confirmed_by drop not null;
alter table public.laundry_pos_payments
 add column confirmed_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_pos_payments
 add constraint pos_payment_one_actor check ((confirmed_by is null) <> (confirmed_staff_id is null));
alter table public.laundry_pos_cash_ledger alter column created_by drop not null;
alter table public.laundry_pos_cash_ledger
 add column created_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_pos_cash_ledger
 add constraint pos_cash_one_actor check ((created_by is null) <> (created_staff_id is null));
alter table public.laundry_pos_cash_shifts alter column opened_by drop not null;
alter table public.laundry_pos_cash_shifts
 add column opened_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_pos_cash_shifts
 add constraint pos_shift_open_one_actor check ((opened_by is null) <> (opened_staff_id is null));
alter table public.laundry_pos_cash_shifts
 add column closed_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_pos_cash_shifts
 add constraint pos_shift_close_one_actor check (closed_at is null or ((closed_by is null) <> (closed_staff_id is null)));

-- Strengthen the existing token guard: payment/refund permissions checked in DB,
-- without broadening any owner-only legacy RPC or granting table DML.
create or replace function laundry_private.pos_g4_cashier_authorize(
 p_device_token text,p_login_token text,p_permission text,p_write boolean default false)
returns table(staff_id uuid,outlet_id uuid,staff_username text)
language plpgsql security definer set search_path='' stable as $$
declare v_session record;
begin
 if p_permission not in ('order_view','order_create','order_work','member_lookup',
                         'payment_collect','refund_full','cash_view') then
   raise exception 'POS_PERMISSION_INVALID' using errcode='42501';
 end if;
 select s.staff_id,s.outlet_id,s.username,s.permissions,s.write_enabled into v_session
 from laundry_private.pos_cashier_logged_in(p_device_token,p_login_token) s;
 if not found or not coalesce((v_session.permissions->>p_permission)::boolean,false) then
   raise exception 'POS_ACCESS_DENIED' using errcode='42501';
 end if;
 if p_write and not v_session.write_enabled then
   raise exception 'POS_WRITES_DISABLED' using errcode='42501';
 end if;
 return query select v_session.staff_id,v_session.outlet_id,v_session.username;
end;
$$;
revoke all on function laundry_private.pos_g4_cashier_authorize(text,text,text,boolean) from public,anon,authenticated;

-- Single outlet has one physical cash register (MAIN). Full shift management,
-- opening balance and counting remain G6; G5 opens a zero-opening shift so the
-- required receipt/ledger/shift FK is always present for tested POS payments.
create function laundry_private.pos_g5_open_shift(
 p_device_token text,p_login_token text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; v_hash bytea; v_old record; v_id uuid; v_result jsonb;
begin
 select z.staff_id,z.outlet_id into a
 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'payment_collect',false) z;
 if p_request_id is null then raise exception 'POS_REQUEST_ID_REQUIRED' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('operation','OPEN_SHIFT','outlet',a.outlet_id)::text,'sha256');
 select c.actor_staff_id,c.operation,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_staff_id is distinct from a.staff_id or v_old.operation<>'OPEN_SHIFT'
      or v_old.payload_digest<>v_hash then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets o
 where o.id=a.outlet_id and o.active and o.write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_staff_id,c.operation,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_staff_id is distinct from a.staff_id or v_old.operation<>'OPEN_SHIFT'
      or v_old.payload_digest<>v_hash then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 select s.id into v_id from public.laundry_pos_cash_shifts s
 where s.outlet_id=a.outlet_id and s.register_code='MAIN' and s.closed_at is null for update;
 if v_id is null then
  insert into public.laundry_pos_cash_shifts(outlet_id,register_code,opened_staff_id,opening_idr)
  values(a.outlet_id,'MAIN',a.staff_id,0) returning id into v_id;
 end if;
 v_result:=pg_catalog.jsonb_build_object('shift_id',v_id,'status','OPEN');
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_staff_id,operation,target_id,payload_digest,result)
 values(p_request_id,a.outlet_id,a.staff_id,'OPEN_SHIFT',v_id,v_hash,v_result);
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_g5_open_shift(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_open_shift(text,text,uuid) to anon,authenticated;
create function public.laundry_pos_g5_open_shift(p_device_token text,p_login_token text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g5_open_shift(p_device_token,p_login_token,p_request_id); $$;
revoke all on function public.laundry_pos_g5_open_shift(text,text,uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_g5_open_shift(text,text,uuid) to anon,authenticated;

-- Read-only limited payment summary, accessible even while financial writes are
-- disabled. Status is computed from committed payment rows, not client input.
create function laundry_private.pos_g5_financial(
 p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare a record; o record; v_paid bigint; v_refunded bigint; v_shift uuid; v_receipts jsonb;
begin
 select z.staff_id,z.outlet_id into a
 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false) z;
 select id,total_idr,refund_status,lifecycle_status,version,member_id into o
 from public.laundry_pos_orders where id=p_order_id and outlet_id=a.outlet_id;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='22023';end if;
 select coalesce(sum(case when entry_type='RECEIPT' then amount_idr else 0 end),0),
        coalesce(sum(case when entry_type='REFUND' then amount_idr else 0 end),0)
 into v_paid,v_refunded from public.laundry_pos_payments where order_id=p_order_id;
 select id into v_shift from public.laundry_pos_cash_shifts
 where outlet_id=a.outlet_id and register_code='MAIN' and closed_at is null limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',entry_type,'method',method,
   'amount_idr',amount_idr::text,'at',confirmed_at) order by confirmed_at,id),'[]'::jsonb)
 into v_receipts from public.laundry_pos_payments where order_id=p_order_id;
 return jsonb_build_object('order_id',p_order_id,'total_idr',o.total_idr::text,
  'paid_idr',v_paid::text,'refunded_idr',v_refunded::text,
  'remaining_idr',(case when o.refund_status='FULLY_REFUNDED' then 0
     else greatest(o.total_idr-v_paid,0) end)::text,
  'payment_status',case when o.refund_status='FULLY_REFUNDED' then 'REFUNDED'
    when o.total_idr=0 then 'ZERO_TOTAL' when v_paid=0 then 'UNPAID'
    when v_paid=o.total_idr then 'PAID' else 'PARTIAL' end,
  'refund_status',o.refund_status,'version',o.version,
  'shift_open',v_shift is not null,'receipts',v_receipts);
end;
$$;
revoke all on function laundry_private.pos_g5_financial(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_financial(text,text,uuid) to anon,authenticated;
create function public.laundry_pos_g5_financial(p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_g5_financial(p_device_token,p_login_token,p_order_id); $$;
revoke all on function public.laundry_pos_g5_financial(text,text,uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_g5_financial(text,text,uuid) to anon,authenticated;

-- Atomic payment + cash ledger + one member ADD/amount snapshot at first full pay.
-- No bank/WhatsApp HTTP inside this SQL transaction. Cash and manual NONCASH
-- confirmations are recorded only after the cashier verifies actual receipt.
create function laundry_private.pos_g5_payment(
 p_device_token text,p_login_token text,p_request_id uuid,p_order_id uuid,
 p_amount_idr text,p_method text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; o record; s record; v_old record;
 v_hash bytea; v_result jsonb; v_amount bigint; v_paid bigint; v_year integer;
 v_now timestamptz; v_rule record; v_tier jsonb; v_points integer:=0;
 v_event uuid; v_receipt uuid; v_ledger uuid; v_is_final boolean;
begin
 select z.staff_id,z.outlet_id into a
 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'payment_collect',false) z;
 if p_request_id is null or p_order_id is null or p_expected_version is null or p_expected_version<1
  or p_amount_idr is null or p_amount_idr !~ '^[1-9][0-9]{0,9}$'
  or p_method not in ('CASH','NONCASH') then
    raise exception 'POS_PAYMENT_INVALID' using errcode='22023';end if;
 v_amount:=p_amount_idr::bigint;
 if v_amount>1000000000 then raise exception 'POS_PAYMENT_LIMIT' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('operation','PAYMENT','order',p_order_id,
   'amount',p_amount_idr,'method',p_method,'version',p_expected_version)::text,'sha256');
 select c.actor_staff_id,c.operation,c.outlet_id,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_staff_id is distinct from a.staff_id or v_old.operation<>'PAYMENT'
   or v_old.outlet_id<>a.outlet_id or v_old.payload_digest<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 -- Lock the one outlet first, then invoice, then open shift, then member/year.
 perform 1 from public.laundry_pos_outlets where id=a.outlet_id and active and write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_staff_id,c.operation,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_staff_id is distinct from a.staff_id or v_old.operation<>'PAYMENT'
   or v_old.payload_digest<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 select * into o from public.laundry_pos_orders where id=p_order_id
   and outlet_id=a.outlet_id and lifecycle_status='CONFIRMED' for update;
 if not found or o.refund_status<>'NONE' or o.total_idr=0 then
   raise exception 'POS_ORDER_NOT_PAYABLE' using errcode='22023';end if;
 if o.version<>p_expected_version then raise exception 'POS_ORDER_VERSION_CONFLICT' using errcode='22023';end if;
 select coalesce(sum(amount_idr),0) into v_paid
 from public.laundry_pos_payments where order_id=p_order_id and entry_type='RECEIPT';
 if v_amount>o.total_idr-v_paid then raise exception 'POS_OVERPAYMENT' using errcode='22023';end if;
 select id into s from public.laundry_pos_cash_shifts where outlet_id=a.outlet_id
   and register_code='MAIN' and closed_at is null for update;
 if not found then raise exception 'POS_SHIFT_NOT_OPEN' using errcode='22023';end if;
 v_is_final:=(v_paid+v_amount=o.total_idr);
 if v_is_final and o.member_id is not null then
   perform 1 from public.laundry_members m where m.id=o.member_id and m.is_active for share;
   if not found then raise exception 'POS_MEMBER_INACTIVE' using errcode='22023';end if;
   -- This timestamp comes AFTER the order lock, not now() at transaction start.
   v_now:=clock_timestamp();
   v_year:=extract(year from timezone('Asia/Jakarta',v_now))::integer;
   select r.tiers,r.revision into v_rule from public.laundry_point_rules r
    where r.program_year=v_year for share;
   if not found then raise exception 'POINT_RULE_MISSING' using errcode='22023';end if;
   for v_tier in select value from pg_catalog.jsonb_array_elements(v_rule.tiers)
    order by (value->>'minimum')::bigint loop
    if o.total_idr >= (v_tier->>'minimum')::bigint then
      v_points:=(v_tier->>'points')::integer;
    end if;
   end loop;
 else
   v_now:=clock_timestamp();
 end if;
 -- Calculate result *before* first write. Commands are immutable (no UPDATE).
 v_receipt:=gen_random_uuid();
 if v_is_final and o.member_id is not null then v_event:=gen_random_uuid();end if;
 v_result:=pg_catalog.jsonb_build_object('order_id',p_order_id,'payment_id',v_receipt,
   'received_idr',v_amount::text,'paid_idr',(v_paid+v_amount)::text,
   'remaining_idr',(o.total_idr-v_paid-v_amount)::text,'payment_status',
   case when v_is_final then 'PAID' else 'PARTIAL' end,
   'points_awarded',case when v_is_final and o.member_id is not null then v_points else 0 end,
   'version',o.version+1);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_staff_id,operation,target_id,payload_digest,result)
  values(p_request_id,a.outlet_id,a.staff_id,'PAYMENT',p_order_id,v_hash,v_result);
 insert into public.laundry_pos_payments(id,order_id,outlet_id,command_id,shift_id,entry_type,method,amount_idr,
       confirmed_staff_id,confirmed_at)
  values(v_receipt,p_order_id,a.outlet_id,p_request_id,s.id,'RECEIPT',p_method,v_amount,a.staff_id,v_now);
 insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,payment_id,command_id,direction,method,
     amount_idr,category,created_staff_id,occurred_at)
  values(a.outlet_id,s.id,v_receipt,p_request_id,'IN',p_method,v_amount,'PAYMENT',a.staff_id,v_now);
 if v_is_final and o.member_id is not null then
   -- Dedicated cashier actor; never create a fake auth user or owner identity.
   insert into public.laundry_checklist_events(id,member_id,event_type,request_id,actor_staff_id,occurred_at)
    values(v_event,o.member_id,'ADD',gen_random_uuid(),a.staff_id,v_now);
   insert into public.laundry_amount_transactions(visit_event_id,member_id,actor_staff_id,
       amount_idr,description,program_year,awarded_points,rule_revision,occurred_at)
    values(v_event,o.member_id,a.staff_id,o.total_idr,'POS '||o.invoice_no,
      v_year,v_points,v_rule.revision,v_now);
   insert into public.laundry_pos_point_links(order_id,link_type,event_id,member_id,program_year,
      amount_idr,awarded_points,rule_revision,command_id)
    values(p_order_id,'ADD',v_event,o.member_id,v_year,o.total_idr,v_points,v_rule.revision,p_request_id);
 end if;
 update public.laundry_pos_orders set version=version+1 where id=p_order_id;
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_g5_payment(text,text,uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_payment(text,text,uuid,uuid,text,text,bigint) to anon,authenticated;
create function public.laundry_pos_g5_payment(
 p_device_token text,p_login_token text,p_request_id uuid,p_order_id uuid,
 p_amount_idr text,p_method text,p_expected_version bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g5_payment(p_device_token,p_login_token,p_request_id,p_order_id,
 p_amount_idr,p_method,p_expected_version); $$;
revoke all on function public.laundry_pos_g5_payment(text,text,uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.laundry_pos_g5_payment(text,text,uuid,uuid,text,text,bigint) to anon,authenticated;

-- Full refund for a closed/single-outlet register: each original RECEIPT
-- creates exactly one immutable REFUND and OUT cash ledger entry. No partial
-- or repricing support. One POS VOID closes the original awarded point cycle.
create function laundry_private.pos_g5_refund_full(
 p_device_token text,p_login_token text,p_request_id uuid,
 p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; o record; s record; c record; v_old record; v_link record;
 v_hash bytea; v_result jsonb; v_total bigint:=0; v_count integer:=0;
 v_refund uuid; v_void uuid; v_now timestamptz;
begin
 select z.staff_id,z.outlet_id into a
 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'refund_full',false) z;
 if p_request_id is null or p_order_id is null or p_expected_version is null or p_expected_version<1
 or p_reason is null or length(btrim(p_reason)) not between 3 and 300
 or p_reason ~ '[[:cntrl:]]' then raise exception 'POS_REFUND_INVALID' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('operation','FULL_REFUND','order',p_order_id,
    'reason',btrim(p_reason),'version',p_expected_version)::text,'sha256');
 select x.actor_staff_id,x.operation,x.outlet_id,x.payload_digest,x.result into v_old
 from public.laundry_pos_commands x where x.request_id=p_request_id;
 if found then
  if v_old.actor_staff_id is distinct from a.staff_id or v_old.operation<>'FULL_REFUND'
     or v_old.outlet_id<>a.outlet_id or v_old.payload_digest<>v_hash then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets where id=a.outlet_id and active and write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select x.actor_staff_id,x.operation,x.outlet_id,x.payload_digest,x.result into v_old
 from public.laundry_pos_commands x where x.request_id=p_request_id;
 if found then
  if v_old.actor_staff_id is distinct from a.staff_id or v_old.operation<>'FULL_REFUND'
     or v_old.outlet_id<>a.outlet_id or v_old.payload_digest<>v_hash then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 select * into o from public.laundry_pos_orders where id=p_order_id
 and outlet_id=a.outlet_id and lifecycle_status='CONFIRMED' for update;
 if not found or o.refund_status<>'NONE' or o.total_idr=0 then
  raise exception 'POS_REFUND_ORDER_INVALID' using errcode='22023';end if;
 if o.version<>p_expected_version then raise exception 'POS_ORDER_VERSION_CONFLICT' using errcode='22023';end if;
 select id into s from public.laundry_pos_cash_shifts where outlet_id=a.outlet_id
  and register_code='MAIN' and closed_at is null for update;
 if not found then raise exception 'POS_SHIFT_NOT_OPEN' using errcode='22023';end if;
 select coalesce(sum(p.amount_idr),0),count(*) into v_total,v_count
 from public.laundry_pos_payments p where p.order_id=p_order_id and p.entry_type='RECEIPT';
 if v_count=0 then raise exception 'POS_NOTHING_TO_REFUND' using errcode='22023';end if;
 if exists(select 1 from public.laundry_pos_payments p
  where p.order_id=p_order_id and p.entry_type='REFUND') then
  raise exception 'POS_REFUND_ALREADY_POSTED' using errcode='22023';end if;
 select pl.* into v_link from public.laundry_pos_point_links pl
 where pl.order_id=p_order_id and pl.link_type='ADD' and pl.award_cycle=1;
 v_now:=clock_timestamp();
 v_result:=pg_catalog.jsonb_build_object('order_id',p_order_id,'refunded_idr',v_total::text,
  'refund_count',v_count,'payment_status','REFUNDED','version',o.version+1,
  'point_reversed',v_link.id is not null);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_staff_id,operation,target_id,payload_digest,result)
  values(p_request_id,a.outlet_id,a.staff_id,'FULL_REFUND',p_order_id,v_hash,v_result);
 for c in select p.id,p.method,p.amount_idr from public.laundry_pos_payments p
  where p.order_id=p_order_id and p.entry_type='RECEIPT' order by p.confirmed_at,p.id
 loop
  v_refund:=gen_random_uuid();
  insert into public.laundry_pos_payments(id,order_id,outlet_id,command_id,shift_id,
    entry_type,original_receipt_id,method,amount_idr,confirmed_staff_id,confirmed_at)
  values(v_refund,p_order_id,a.outlet_id,p_request_id,s.id,'REFUND',c.id,c.method,c.amount_idr,a.staff_id,v_now);
  insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,payment_id,command_id,direction,method,
    amount_idr,category,created_staff_id,occurred_at)
  values(a.outlet_id,s.id,v_refund,p_request_id,'OUT',c.method,c.amount_idr,'REFUND',a.staff_id,v_now);
 end loop;
 if v_link.id is not null then
  v_void:=gen_random_uuid();
  insert into public.laundry_checklist_events(id,member_id,event_type,reverses_event_id,
    reason,request_id,actor_staff_id,occurred_at)
  values(v_void,v_link.member_id,'VOID',v_link.event_id,btrim(p_reason),gen_random_uuid(),a.staff_id,v_now);
  insert into public.laundry_pos_point_links(order_id,award_cycle,link_type,event_id,member_id,
    program_year,amount_idr,awarded_points,rule_revision,command_id)
  values(p_order_id,1,'VOID',v_void,v_link.member_id,v_link.program_year,v_link.amount_idr,
    v_link.awarded_points,v_link.rule_revision,p_request_id);
 end if;
 update public.laundry_pos_orders set refund_status='FULLY_REFUNDED',version=version+1
  where id=p_order_id;
 insert into public.laundry_pos_order_events(order_id,command_id,actor_staff_id,kind,reason,data)
  values(p_order_id,p_request_id,a.staff_id,'FULL_REFUND',btrim(p_reason),
    pg_catalog.jsonb_build_object('amount_idr',v_total::text,'count',v_count));
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_g5_refund_full(text,text,uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_refund_full(text,text,uuid,uuid,text,bigint) to anon,authenticated;
create function public.laundry_pos_g5_refund_full(
 p_device_token text,p_login_token text,p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g5_refund_full(p_device_token,p_login_token,p_request_id,
 p_order_id,p_reason,p_expected_version); $$;
revoke all on function public.laundry_pos_g5_refund_full(text,text,uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.laundry_pos_g5_refund_full(text,text,uuid,uuid,text,bigint) to anon,authenticated;

-- After single-shop POS cutover, an owner cannot accidentally record an extra
-- manual ADD/amount visit for the same operational sales stream. Historical
-- reads, VOID corrections and pre-cutover registrations remain available.
create function laundry_private.pos_guard_legacy_manual_add()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.event_type='ADD' and new.actor_id is not null and exists(
  select 1 from public.laundry_pos_outlets where singleton_key=1 and active and write_enabled)
 then raise exception 'POS_LEGACY_MANUAL_AWARD_DISABLED' using errcode='42501';end if;
 return new;
end;
$$;
revoke all on function laundry_private.pos_guard_legacy_manual_add() from public,anon,authenticated;
create trigger pos_legacy_add_cutover_guard
 before insert on public.laundry_checklist_events
 for each row execute function laundry_private.pos_guard_legacy_manual_add();

comment on function public.laundry_pos_g5_payment(text,text,uuid,uuid,text,text,bigint)
 is 'G5: locked single-shop receipt and cash entry, member points exactly once on full payment; disabled until approved POS cutover.';
comment on function public.laundry_pos_g5_refund_full(text,text,uuid,uuid,text,bigint)
 is 'G5: full refund per receipt plus point VOID; no partial refunds and no raw-table grants.';