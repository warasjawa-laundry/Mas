-- G6 Mas Jawa Laundry: one register, append-only cash journal, controlled close,
-- role-filtered reports. Never apply automatically to operational Supabase.
-- Rollout guarded by POS outlet.write_enabled (default false).

-- Replace the original G2 check (which required closed_by Auth) with staff-compatible
-- closed_staff_id XOR; existing closed owner history is preserved.
alter table public.laundry_pos_cash_shifts
 drop constraint if exists laundry_pos_cash_shifts_check;
alter table public.laundry_pos_cash_shifts
 add constraint pos_shift_close_fields check (
  (closed_at is null and closed_by is null and closed_staff_id is null and
   counted_idr is null and discrepancy_idr is null) or
  (closed_at is not null and counted_idr is not null and discrepancy_idr is not null and
   ((closed_by is null) <> (closed_staff_id is null))));

alter table public.laundry_pos_cash_shifts
  add column close_reason text check (close_reason is null or char_length(close_reason) between 3 and 300);

-- Extend exact permission allowlist; no client table grants are added.
create or replace function laundry_private.pos_g4_cashier_authorize(
 p_device_token text,p_login_token text,p_permission text,p_write boolean default false)
returns table(staff_id uuid,outlet_id uuid,staff_username text)
language plpgsql security definer set search_path='' stable as $$
declare v_session record;
begin
 if p_permission not in ('order_view','order_create','order_work','member_lookup',
    'payment_collect','refund_full','cash_view','cash_entry','reports_view','whatsapp_draft') then
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

-- Stable read for current shift and recent, scoped entries.
create function laundry_private.pos_g6_cash_overview(p_device_token text,p_login_token text)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare a record; s record; v_cash bigint:=0; v_in bigint:=0; v_out bigint:=0; v_entries jsonb;
begin
 select z.staff_id,z.outlet_id into a from laundry_private.pos_g4_cashier_authorize(
    p_device_token,p_login_token,'cash_view',false) z;
 select * into s from public.laundry_pos_cash_shifts
  where outlet_id=a.outlet_id and register_code='MAIN' and closed_at is null;
 if found then
  select coalesce(sum(case when method='CASH' and direction='IN' then amount_idr else 0 end),0),
         coalesce(sum(case when method='CASH' and direction='OUT' then amount_idr else 0 end),0)
   into v_in,v_out from public.laundry_pos_cash_ledger where shift_id=s.id;
  v_cash:=s.opening_idr+v_in-v_out;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('direction',x.direction,'category',x.category,
   'method',x.method,'amount_idr',x.amount_idr::text,'note',x.note,'occurred_at',x.occurred_at,
   'invoice_no',x.invoice_no,'shift_id',x.shift_id) order by x.occurred_at desc,x.id desc),'[]'::jsonb)
 into v_entries from (
  select l.id,l.direction,l.category,l.method,l.amount_idr,l.note,l.occurred_at,l.shift_id,
    o.invoice_no from public.laundry_pos_cash_ledger l
  left join public.laundry_pos_payments p on p.id=l.payment_id
  left join public.laundry_pos_orders o on o.id=p.order_id
  where l.outlet_id=a.outlet_id order by l.occurred_at desc,l.id desc limit 80
 ) x;
 return jsonb_build_object('open',s.id is not null,'shift_id',s.id,
   'opened_at',s.opened_at,'opening_idr',coalesce(s.opening_idr,0)::text,
   'cash_in_idr',v_in::text,'cash_out_idr',v_out::text,
   'expected_cash_idr',v_cash::text,'write_enabled',(
    select o.write_enabled from public.laundry_pos_outlets o where o.id=a.outlet_id),
   'entries',v_entries);
end;
$$;
revoke all on function laundry_private.pos_g6_cash_overview(text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6_cash_overview(text,text) to anon,authenticated;
create function public.laundry_pos_g6_cash_overview(p_device_token text,p_login_token text)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_g6_cash_overview(p_device_token,p_login_token); $$;
revoke all on function public.laundry_pos_g6_cash_overview(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g6_cash_overview(text,text) to anon,authenticated;

-- Append-only non-sale CASH entry; cannot be smuggled as a payment or award.
create function laundry_private.pos_g6_cash_entry(
 p_device_token text,p_login_token text,p_request_id uuid,
 p_direction text,p_amount_idr text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; s record; v_old record; v_amount bigint; v_hash bytea;
        v_result jsonb; v_direction text:=p_direction; v_reason text:=btrim(coalesce(p_reason,''));
begin
 select z.staff_id,z.outlet_id into a from laundry_private.pos_g4_cashier_authorize(
   p_device_token,p_login_token,'cash_entry',false) z;
 if p_request_id is null or v_direction not in ('IN','OUT') or
  p_amount_idr is null or p_amount_idr !~ '^[1-9][0-9]{0,9}$' or
  length(v_reason) not between 3 and 300 or v_reason ~ '[[:cntrl:]]' then
  raise exception 'POS_CASH_ENTRY_INVALID' using errcode='22023';end if;
 v_amount:=p_amount_idr::bigint;
 if v_amount>1000000000 then raise exception 'POS_CASH_LIMIT' using errcode='22023';end if;
 v_hash:=extensions.digest(jsonb_build_object('type','CASH_ENTRY','direction',v_direction,
   'amount',p_amount_idr,'reason',v_reason)::text,'sha256');
 select c.actor_staff_id,c.operation,c.outlet_id,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_staff_id is distinct from a.staff_id or v_old.operation<>'CASH_ENTRY' or
   v_old.outlet_id<>a.outlet_id or v_old.payload_digest<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets o where o.id=a.outlet_id and o.active and o.write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_staff_id,c.operation,c.outlet_id,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_staff_id is distinct from a.staff_id or v_old.operation<>'CASH_ENTRY' or
   v_old.outlet_id<>a.outlet_id or v_old.payload_digest<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 select * into s from public.laundry_pos_cash_shifts where outlet_id=a.outlet_id and
   register_code='MAIN' and closed_at is null for update;
 if not found then raise exception 'POS_SHIFT_NOT_OPEN' using errcode='22023';end if;
 v_result:=jsonb_build_object('shift_id',s.id,'direction',v_direction,
   'amount_idr',v_amount::text,'status','POSTED');
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_staff_id,
   operation,target_id,payload_digest,result)
 values(p_request_id,a.outlet_id,a.staff_id,'CASH_ENTRY',s.id,v_hash,v_result);
 insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,command_id,direction,
   method,amount_idr,category,note,created_staff_id)
 values(a.outlet_id,s.id,p_request_id,v_direction,'CASH',v_amount,
  case when v_direction='IN' then 'NON_SALE_IN' else 'NON_SALE_OUT' end,v_reason,a.staff_id);
 return v_result;
end; $$;
revoke all on function laundry_private.pos_g6_cash_entry(text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6_cash_entry(text,text,uuid,text,text,text) to anon,authenticated;
create function public.laundry_pos_g6_cash_entry(
 p_device_token text,p_login_token text,p_request_id uuid,
 p_direction text,p_amount_idr text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g6_cash_entry(p_device_token,p_login_token,p_request_id,
   p_direction,p_amount_idr,p_reason); $$;
revoke all on function public.laundry_pos_g6_cash_entry(text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g6_cash_entry(text,text,uuid,text,text,text) to anon,authenticated;

-- Close takes outlet -> shift lock (the identical order used by G5 payment).
create function laundry_private.pos_g6_close_shift(
 p_device_token text,p_login_token text,p_request_id uuid,p_counted_idr text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; s record; v_old record; v_hash bytea; v_counted bigint; v_expected bigint;
  v_difference bigint; v_reason text:=btrim(coalesce(p_reason,'')); v_result jsonb;
begin
 select z.staff_id,z.outlet_id into a from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'cash_entry',false) z;
 if p_request_id is null or p_counted_idr is null or p_counted_idr !~ '^(0|[1-9][0-9]{0,9})$' or
    length(v_reason)>300 or v_reason ~ '[[:cntrl:]]' then
   raise exception 'POS_SHIFT_CLOSE_INVALID' using errcode='22023';end if;
 v_counted:=p_counted_idr::bigint;
 if v_counted>1000000000 then raise exception 'POS_SHIFT_COUNT_LIMIT' using errcode='22023';end if;
 v_hash:=extensions.digest(jsonb_build_object('type','CLOSE_SHIFT',
  'counted',p_counted_idr,'reason',v_reason)::text,'sha256');
 select c.actor_staff_id,c.outlet_id,c.operation,c.payload_digest,c.result into v_old
  from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_staff_id is distinct from a.staff_id or v_old.outlet_id<>a.outlet_id or
   v_old.operation<>'CLOSE_SHIFT' or v_old.payload_digest<>v_hash then
   raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets o where o.id=a.outlet_id and o.active and o.write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_staff_id,c.outlet_id,c.operation,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_staff_id is distinct from a.staff_id or v_old.outlet_id<>a.outlet_id or
   v_old.operation<>'CLOSE_SHIFT' or v_old.payload_digest<>v_hash then
   raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 select * into s from public.laundry_pos_cash_shifts where outlet_id=a.outlet_id and
    register_code='MAIN' and closed_at is null for update;
 if not found then raise exception 'POS_SHIFT_NOT_OPEN' using errcode='22023';end if;
 select s.opening_idr + coalesce(sum(case when method='CASH' then
   case when direction='IN' then amount_idr else -amount_idr end else 0 end),0)
 into v_expected from public.laundry_pos_cash_ledger where shift_id=s.id;
 v_difference:=v_counted-v_expected;
 if v_difference<>0 and length(v_reason)<3 then
   raise exception 'POS_SHIFT_DISCREPANCY_REQUIRES_REASON' using errcode='22023';end if;
 update public.laundry_pos_cash_shifts set closed_at=clock_timestamp(),
  closed_staff_id=a.staff_id,counted_idr=v_counted,discrepancy_idr=v_difference,
  close_reason=nullif(v_reason,'') where id=s.id;
 v_result:=jsonb_build_object('shift_id',s.id,'status','CLOSED',
  'expected_cash_idr',v_expected::text,'counted_idr',v_counted::text,
  'discrepancy_idr',v_difference::text);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_staff_id,operation,
  target_id,payload_digest,result)
 values(p_request_id,a.outlet_id,a.staff_id,'CLOSE_SHIFT',s.id,v_hash,v_result);
 return v_result;
end; $$;
revoke all on function laundry_private.pos_g6_close_shift(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6_close_shift(text,text,uuid,text,text) to anon,authenticated;
create function public.laundry_pos_g6_close_shift(
 p_device_token text,p_login_token text,p_request_id uuid,p_counted_idr text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g6_close_shift(p_device_token,p_login_token,
  p_request_id,p_counted_idr,p_reason); $$;
revoke all on function public.laundry_pos_g6_close_shift(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g6_close_shift(text,text,uuid,text,text) to anon,authenticated;

-- Operational period report; all intervals are half-open UTC boundaries
-- corresponding to user-selected WIB days. Never mislabel it accounting profit.
create function laundry_private.pos_g6_report(
 p_device_token text,p_login_token text,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare a record; v_cash_in bigint;v_cash_out bigint;v_non_cash_in bigint;v_non_cash_out bigint;
 v_created bigint;v_receivable bigint;v_points bigint;v_entries jsonb;
begin
 select z.staff_id,z.outlet_id into a from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'reports_view',false) z;
 if p_start is null or p_end is null or p_end<=p_start or p_end>p_start+interval '93 days' then
   raise exception 'POS_REPORT_INTERVAL_INVALID' using errcode='22023';end if;
 select coalesce(sum(case when method='CASH' and direction='IN' then amount_idr else 0 end),0),
  coalesce(sum(case when method='CASH' and direction='OUT' then amount_idr else 0 end),0),
  coalesce(sum(case when method='NONCASH' and direction='IN' then amount_idr else 0 end),0),
  coalesce(sum(case when method='NONCASH' and direction='OUT' then amount_idr else 0 end),0)
 into v_cash_in,v_cash_out,v_non_cash_in,v_non_cash_out
 from public.laundry_pos_cash_ledger where outlet_id=a.outlet_id and occurred_at>=p_start and occurred_at<p_end;
 select count(*) into v_created from public.laundry_pos_orders
 where outlet_id=a.outlet_id and created_at>=p_start and created_at<p_end;
 -- Receivables as-of p_end: full refunds excluded, only confirmed receipt sums
 -- up to cutoff count against the original receivable.
 select coalesce(sum(greatest(o.total_idr-coalesce(p.paid,0),0)),0) into v_receivable
 from public.laundry_pos_orders o
 left join lateral (select sum(x.amount_idr) paid from public.laundry_pos_payments x
   where x.order_id=o.id and x.entry_type='RECEIPT' and x.confirmed_at<p_end) p on true
 where o.outlet_id=a.outlet_id and o.created_at<p_end and o.lifecycle_status='CONFIRMED'
   and not exists(select 1 from public.laundry_pos_payments x where x.order_id=o.id and
         x.entry_type='REFUND' and x.confirmed_at<p_end);
 select coalesce(sum(case when l.link_type='ADD' then l.awarded_points
                   when l.link_type='VOID' then -l.awarded_points else 0 end),0)
  into v_points from public.laundry_pos_point_links l
  join public.laundry_pos_orders o on o.id=l.order_id
  where o.outlet_id=a.outlet_id and l.created_at>=p_start and l.created_at<p_end;
 select coalesce(jsonb_agg(jsonb_build_object('type',q.direction,'method',q.method,
   'category',q.category,'amount_idr',q.amount_idr::text,'invoice_no',q.invoice_no,
   'occurred_at',q.occurred_at,'note',q.note) order by q.occurred_at desc,q.id desc),'[]'::jsonb)
 into v_entries from (
  select l.id,l.direction,l.method,l.category,l.amount_idr,l.occurred_at,l.note,o.invoice_no
  from public.laundry_pos_cash_ledger l
  left join public.laundry_pos_payments p on p.id=l.payment_id
  left join public.laundry_pos_orders o on o.id=p.order_id
  where l.outlet_id=a.outlet_id and l.occurred_at>=p_start and l.occurred_at<p_end
  order by l.occurred_at desc,l.id desc limit 300
 ) q;
 return jsonb_build_object('schema_version',1,'start',p_start,'end_exclusive',p_end,
 'outlet','MJL','orders_created',v_created,
 'cash_in_idr',v_cash_in::text,'cash_out_idr',v_cash_out::text,
 'noncash_in_idr',v_non_cash_in::text,'noncash_out_idr',v_non_cash_out::text,
 'receivables_as_of_end_idr',v_receivable::text,'net_pos_points',v_points,
 'rows',v_entries,'truncated',(
   select count(*)>300 from public.laundry_pos_cash_ledger
   where outlet_id=a.outlet_id and occurred_at>=p_start and occurred_at<p_end));
end; $$;
revoke all on function laundry_private.pos_g6_report(text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6_report(text,text,timestamptz,timestamptz) to anon,authenticated;
create function public.laundry_pos_g6_report(
 p_device_token text,p_login_token text,p_start timestamptz,p_end timestamptz)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_g6_report(p_device_token,p_login_token,p_start,p_end); $$;
revoke all on function public.laundry_pos_g6_report(text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.laundry_pos_g6_report(text,text,timestamptz,timestamptz) to anon,authenticated;