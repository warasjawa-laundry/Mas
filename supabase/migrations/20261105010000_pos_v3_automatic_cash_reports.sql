-- V3 adds opt-in entry points. Existing financial cores, pilot gates and journal rules remain.
-- Opening is a carried book balance, not a fresh cash receipt; it can include an old deficit.
alter table public.laundry_pos_cash_shifts drop constraint laundry_pos_cash_shifts_opening_idr_check;
alter table public.laundry_pos_cash_shifts add constraint laundry_pos_cash_shifts_opening_idr_check check(opening_idr between -9000000000000000 and 9000000000000000);
create function laundry_private.pos_v3_auto_cash(p_owner uuid,p_staff uuid,p_outlet uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare shift_v uuid; carry_v bigint;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 perform 1 from public.laundry_pos_outlets where id=p_outlet and active and write_enabled and finance_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select id into shift_v from public.laundry_pos_cash_shifts where outlet_id=p_outlet and register_code='MAIN' and closed_at is null for update;
 if shift_v is null then
  select coalesce(sum(case direction when 'IN' then amount_idr else -amount_idr end),0)
   into carry_v from public.laundry_pos_cash_ledger where outlet_id=p_outlet and method='CASH';
  carry_v:=carry_v+coalesce((select opening_idr from public.laundry_pos_cash_shifts where outlet_id=p_outlet and register_code='MAIN' order by opened_at,id limit 1),0);
  insert into public.laundry_pos_cash_shifts(outlet_id,register_code,opened_by,opened_staff_id,opening_idr)
   values(p_outlet,'MAIN',p_owner,p_staff,carry_v) returning id into shift_v;
 end if;
 return shift_v;
end;$$;
revoke all on function laundry_private.pos_v3_auto_cash(uuid,uuid,uuid) from public,anon,authenticated;

create table laundry_private.pos_v3_payment_methods(request_id uuid primary key references public.laundry_pos_commands(request_id),
 payment_id uuid not null unique references public.laundry_pos_payments(id),method text not null check(method in ('CASH','NONCASH','TRANSFER','QRIS')));
alter table laundry_private.pos_v3_payment_methods enable row level security;
revoke all on laundry_private.pos_v3_payment_methods from public,anon,authenticated;
create trigger pos_v3_method_immutable before update or delete on laundry_private.pos_v3_payment_methods for each row execute function laundry_private.pos_reject_journal_changes();

create function public.laundry_pos_v3_finance(p_operation text,p_request_id uuid,p_order_id uuid default null,
 p_amount_idr text default null,p_method text default null,p_expected_version bigint default null,
 p_reason text default null,p_direction text default null,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_v uuid;staff_v uuid;outlet_v uuid;grant_v text;result_v jsonb;
begin
 grant_v:=case p_operation when 'PAYMENT' then 'payment_collect' when 'FULL_REFUND' then 'refund_full' when 'CASH_ENTRY' then 'cash_entry' end;
 if grant_v is null then raise exception 'POS_OPERATION_INVALID' using errcode='22023';end if;
 if p_device_token is null and p_login_token is null then
  owner_v:=laundry_private.pos_owner_required();outlet_v:=laundry_private.pos_owner_outlet();
 else
  select staff_id,outlet_id into staff_v,outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,grant_v,false);
 end if;
 -- An existing request must go straight to the original digest/actor conflict checks.
 if not exists(select 1 from public.laundry_pos_commands where request_id=p_request_id) then
  perform laundry_private.pos_v3_auto_cash(owner_v,staff_v,outlet_v);
 end if;
 if p_operation='PAYMENT' then
  if p_method is null or p_method not in ('CASH','NONCASH','TRANSFER','QRIS') then raise exception 'POS_PAYMENT_INVALID';end if;
  if exists(select 1 from laundry_private.pos_v3_payment_methods where request_id=p_request_id and method<>p_method) then raise exception 'POS_REQUEST_CONFLICT';end if;
  if exists(select 1 from public.laundry_pos_commands where request_id=p_request_id) and not exists(select 1 from laundry_private.pos_v3_payment_methods where request_id=p_request_id) and p_method in ('TRANSFER','QRIS') then raise exception 'POS_LEGACY_METHOD_UNVERIFIED';end if;
  result_v:=laundry_private.pos_payment_core(owner_v,staff_v,outlet_v,p_request_id,p_order_id,p_amount_idr,case when p_method in ('TRANSFER','QRIS') then 'NONCASH' else p_method end,p_expected_version);
  insert into laundry_private.pos_v3_payment_methods values(p_request_id,(result_v->>'payment_id')::uuid,p_method) on conflict(request_id) do nothing;
  if not exists(select 1 from laundry_private.pos_v3_payment_methods where request_id=p_request_id and method=p_method and payment_id=(result_v->>'payment_id')::uuid) then raise exception 'POS_REQUEST_CONFLICT';end if;
  return result_v;
 elsif p_operation='FULL_REFUND' then
  return laundry_private.pos_refund_full_core(owner_v,staff_v,outlet_v,p_request_id,p_order_id,p_reason,p_expected_version);
 else
  return laundry_private.pos_cash_entry_core(owner_v,staff_v,outlet_v,p_request_id,p_direction,p_amount_idr,p_reason);
 end if;
end;$$;
revoke all on function public.laundry_pos_v3_finance(text,uuid,uuid,text,text,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v3_finance(text,uuid,uuid,text,text,bigint,text,text,text,text) to anon,authenticated;

create function public.laundry_pos_v3_report(p_start timestamptz,p_end timestamptz,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_v uuid;staff_v uuid;outlet_v uuid;orders_v jsonb;items_v jsonb;cash_v jsonb;summary_v jsonb;
begin
 if p_device_token is null and p_login_token is null then
  owner_v:=laundry_private.pos_owner_required();outlet_v:=laundry_private.pos_owner_outlet();
 else
  select staff_id,outlet_id into staff_v,outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'reports_view',false);
 end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end>p_start+interval '93 days' then raise exception 'POS_REPORT_INTERVAL_INVALID' using errcode='22023';end if;
 if (select count(*) from public.laundry_pos_orders o where o.outlet_id=outlet_v and
  ((o.created_at>=p_start and o.created_at<p_end) or exists(select 1 from public.laundry_pos_payments p where p.order_id=o.id and p.confirmed_at>=p_start and p.confirmed_at<p_end)))>1000
 or (select count(*) from public.laundry_pos_cash_ledger where outlet_id=outlet_v and occurred_at>=p_start and occurred_at<p_end)>5000 then
  raise exception 'POS_REPORT_LIMIT' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'invoice',o.invoice_no,'created_at',o.created_at,
  'customer',o.customer_name,'creator',coalesce(s.username,'Owner '||o.created_by::text),
  'created_in_period',o.created_at>=p_start and o.created_at<p_end,'total',o.total_idr::text,
  'paid',coalesce(p.paid,0)::text,'refunded',coalesce(p.refunded,0)::text,
  'remaining',case when o.refund_status='FULLY_REFUNDED' or o.lifecycle_status='CANCELLED' then '0' else greatest(o.total_idr-coalesce(p.paid,0),0)::text end,
  'status',case when o.lifecycle_status='CANCELLED' then 'CANCELLED' when o.refund_status='FULLY_REFUNDED' then 'REFUNDED' when o.total_idr=0 then 'ZERO_TOTAL' when coalesce(p.paid,0)=o.total_idr then 'PAID' when coalesce(p.paid,0)>0 then 'PARTIAL' else 'UNPAID' end,
  'is_test_order',o.is_test_order) order by o.created_at,o.id),'[]') into orders_v
 from public.laundry_pos_orders o left join public.laundry_pos_staff s on s.staff_id=o.created_staff_id
 left join lateral(select sum(amount_idr) filter(where entry_type='RECEIPT') paid,sum(amount_idr) filter(where entry_type='REFUND') refunded from public.laundry_pos_payments where order_id=o.id)p on true
 where o.outlet_id=outlet_v and ((o.created_at>=p_start and o.created_at<p_end) or exists(select 1 from public.laundry_pos_payments p where p.order_id=o.id and p.confirmed_at>=p_start and p.confirmed_at<p_end));
 select coalesce(jsonb_agg(jsonb_build_object('order_id',i.order_id,'invoice',o.invoice_no,'name',i.service_name,
  'package',i.package_snapshot,'quantity_milli',i.quantity_milli,'unit',i.unit,'price',i.price_idr::text,'subtotal',i.line_total_idr::text,
  'created_in_period',o.created_at>=p_start and o.created_at<p_end) order by o.created_at,o.id,i.line_number),'[]') into items_v
 from public.laundry_pos_order_items i join public.laundry_pos_orders o on o.id=i.order_id
 where o.id in(select (value->>'id')::uuid from jsonb_array_elements(orders_v));
 if jsonb_array_length(items_v)>30000 then raise exception 'POS_REPORT_LIMIT' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'order_id',p.order_id,'invoice',o.invoice_no,'customer',o.customer_name,
  'at',l.occurred_at,'direction',l.direction,'category',l.category,'method',coalesce(t.method,l.method),'amount',l.amount_idr::text,
  'actor',coalesce(s.username,'Owner '||l.created_by::text),'note',l.note) order by l.occurred_at,l.id),'[]') into cash_v
 from public.laundry_pos_cash_ledger l left join public.laundry_pos_payments p on p.id=l.payment_id
 left join laundry_private.pos_v3_payment_methods t on t.payment_id=coalesce(p.original_receipt_id,p.id)
 left join public.laundry_pos_orders o on o.id=p.order_id left join public.laundry_pos_staff s on s.staff_id=l.created_staff_id
 where l.outlet_id=outlet_v and l.occurred_at>=p_start and l.occurred_at<p_end;
 summary_v:=laundry_private.pos_report_core(owner_v,staff_v,outlet_v,p_start,p_end)||jsonb_build_object('truncated',false);
 return jsonb_build_object('schema_version',3,'start',p_start,'end',p_end,'balance_scope','CURRENT','pilot_test_only',(select pilot_test_only from public.laundry_pos_outlets where id=outlet_v),
  'orders',orders_v,'items',items_v,'cash',cash_v,'summary',summary_v);
end;$$;
revoke all on function public.laundry_pos_v3_report(timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v3_report(timestamptz,timestamptz,text,text) to anon,authenticated;

create function public.laundry_pos_v3_cash(p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_v uuid;staff_v uuid;outlet_v uuid;result_v jsonb;entries_v jsonb;can_view boolean;in_v bigint;out_v bigint;opening_v bigint;
begin
 if p_device_token is null and p_login_token is null then
  owner_v:=laundry_private.pos_owner_required();outlet_v:=laundry_private.pos_owner_outlet();can_view:=true;
 else
  select staff_id,outlet_id into staff_v,outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'cash_view',false);
  select coalesce((permissions->>'order_view')::boolean,false) into can_view from public.laundry_pos_staff_outlets where staff_id=staff_v and outlet_id=outlet_v;
 end if;
 result_v:=laundry_private.pos_cash_overview_core(owner_v,staff_v,outlet_v);
 select coalesce(jsonb_agg(jsonb_build_object('direction',q.direction,'category',q.category,'method',q.method,'amount_idr',q.amount_idr::text,
  'note',q.note,'occurred_at',q.occurred_at,'invoice_no',q.invoice_no,'order_id',q.order_id,'actor',q.actor,
  'customer',case when can_view then q.customer_name end,'can_view_order',can_view) order by q.occurred_at desc,q.id desc),'[]') into entries_v
 from(select l.id,l.direction,l.category,coalesce(t.method,l.method) method,l.amount_idr,l.note,l.occurred_at,p.order_id,o.invoice_no,o.customer_name,coalesce(s.username,'Owner '||l.created_by::text) actor
  from public.laundry_pos_cash_ledger l left join public.laundry_pos_payments p on p.id=l.payment_id
  left join laundry_private.pos_v3_payment_methods t on t.payment_id=coalesce(p.original_receipt_id,p.id)
  left join public.laundry_pos_orders o on o.id=p.order_id left join public.laundry_pos_staff s on s.staff_id=l.created_staff_id
  where l.outlet_id=outlet_v order by l.occurred_at desc,l.id desc limit 80)q;
 select coalesce(sum(amount_idr) filter(where direction='IN'),0),coalesce(sum(amount_idr) filter(where direction='OUT'),0) into in_v,out_v from public.laundry_pos_cash_ledger where outlet_id=outlet_v and method='CASH';
 select opening_idr into opening_v from public.laundry_pos_cash_shifts where outlet_id=outlet_v and register_code='MAIN' order by opened_at,id limit 1;
 return result_v||jsonb_build_object('entries',entries_v,'automatic_cash',true,'reconciliations',case when owner_v is not null then
  coalesce((select jsonb_agg(jsonb_build_object('at',r.occurred_at,'owner',r.owner_id,'expected',r.expected_idr::text,'counted',r.counted_idr::text,'difference',(r.counted_idr-r.expected_idr)::text,'reason',r.reason,'is_test',r.is_test) order by r.occurred_at desc)
   from(select * from laundry_private.pos_cash_reconciliations where outlet_id=outlet_v order by occurred_at desc,request_id desc limit 30)r),'[]') else '[]'::jsonb end,'opening_idr',coalesce(opening_v,0)::text,
  'cash_in_idr',in_v::text,'cash_out_idr',out_v::text,'expected_cash_idr',(coalesce(opening_v,0)+in_v-out_v)::text);
end;$$;
revoke all on function public.laundry_pos_v3_cash(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v3_cash(text,text) to anon,authenticated;

create table laundry_private.pos_cash_reconciliations(
 request_id uuid primary key,owner_id uuid not null references auth.users(id),outlet_id uuid not null references public.laundry_pos_outlets(id),
 expected_idr bigint not null,counted_idr bigint not null check(counted_idr between 0 and 1000000000),reason text not null,occurred_at timestamptz not null default clock_timestamp(),is_test boolean not null default true);
alter table laundry_private.pos_cash_reconciliations enable row level security;
revoke all on laundry_private.pos_cash_reconciliations from public,anon,authenticated;
create trigger pos_reconciliation_immutable before update or delete on laundry_private.pos_cash_reconciliations for each row execute function laundry_private.pos_reject_journal_changes();
create function public.laundry_pos_v3_reconcile(p_request_id uuid,p_counted_idr bigint,p_expected_idr bigint,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_v uuid;outlet_v uuid;balance_v bigint;old_v record;
begin
 owner_v:=laundry_private.pos_owner_required();outlet_v:=laundry_private.pos_owner_outlet();
 if p_request_id is null or p_counted_idr is null or p_counted_idr<0 or p_counted_idr>1000000000 or p_expected_idr is null
  or p_reason is null or length(btrim(p_reason)) not between 3 and 300 or p_reason ~ '[[:cntrl:]]' then raise exception 'POS_INPUT_INVALID';end if;
 perform 1 from public.laundry_pos_outlets where id=outlet_v for update;
 select * into old_v from laundry_private.pos_cash_reconciliations where request_id=p_request_id;
 if found then
  if old_v.owner_id<>owner_v or old_v.outlet_id<>outlet_v or old_v.counted_idr<>p_counted_idr or old_v.expected_idr<>p_expected_idr or old_v.reason<>btrim(p_reason) then raise exception 'POS_REQUEST_CONFLICT';end if;
 else
  select coalesce(sum(case direction when 'IN' then amount_idr else -amount_idr end),0) into balance_v from public.laundry_pos_cash_ledger where outlet_id=outlet_v and method='CASH';
  balance_v:=balance_v+coalesce((select opening_idr from public.laundry_pos_cash_shifts where outlet_id=outlet_v and register_code='MAIN' order by opened_at,id limit 1),0);
  if balance_v<>p_expected_idr then raise exception 'POS_BALANCE_CHANGED';end if;
  insert into laundry_private.pos_cash_reconciliations values(p_request_id,owner_v,outlet_v,balance_v,p_counted_idr,btrim(p_reason),clock_timestamp(),(select pilot_test_only from public.laundry_pos_outlets where id=outlet_v));
 end if;
 return jsonb_build_object('status','RECONCILED','difference_idr',(p_counted_idr-p_expected_idr)::text);
end;$$;
revoke all on function public.laundry_pos_v3_reconcile(uuid,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v3_reconcile(uuid,bigint,bigint,text) to authenticated;

-- Preserve the current complete receipt builder in one shared backend body.
do $migration$
declare body_v text;
begin
 select prosrc into strict body_v from pg_proc where oid='public.laundry_pos_whatsapp_receipt(uuid,text,text,text)'::regprocedure;
 if position('''whatsapp_draft''' in body_v)=0 then raise exception 'Receipt authorization contract changed';end if;
 body_v:=replace(body_v,'''whatsapp_draft''','p_permission');
 execute format('create function laundry_private.pos_v3_receipt_core(p_order_id uuid,p_kind text,p_device_token text,p_login_token text,p_permission text) returns jsonb language plpgsql stable security definer set search_path='''' as %L',body_v);
end;$migration$;
revoke all on function laundry_private.pos_v3_receipt_core(uuid,text,text,text,text) from public,anon,authenticated;
create or replace function public.laundry_pos_whatsapp_receipt(p_order_id uuid,p_kind text,p_device_token text default null,p_login_token text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select laundry_private.pos_v3_receipt_core(p_order_id,p_kind,p_device_token,p_login_token,'whatsapp_draft');$$;
create function public.laundry_pos_print_receipt(p_order_id uuid,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_device_token is not null or p_login_token is not null then
  if not exists(select 1 from laundry_private.pos_cashier_logged_in(p_device_token,p_login_token) s where coalesce((s.permissions->>'receipt_print')::boolean,false)) then
   raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 end if;
 return laundry_private.pos_v3_receipt_core(p_order_id,'NEW',p_device_token,p_login_token,'order_view');
end;$$;
revoke all on function public.laundry_pos_print_receipt(uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_print_receipt(uuid,text,text) to anon,authenticated;
