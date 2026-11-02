-- Owner POS read-only routes (PR #29 follow-up). QA-only until G8 GO.
-- Never grant cashier credentials to an Owner, and never issue financial commands here.
-- All private SECURITY DEFINER functions require active Supabase owner account.
create function laundry_private.pos_owner_board_read()
returns table(id uuid,invoice_no text,customer_name text,total_idr bigint,
 work_status text,payment_status text,created_at timestamptz)
language plpgsql security definer set search_path='' stable as $$
declare v_owner uuid;v_outlet uuid;
begin
 v_owner:=laundry_private.pos_owner_required();
 select o.id into v_outlet from public.laundry_pos_outlets o where o.singleton_key=1 and o.active;
 if v_outlet is null then return; end if;
 return query
 select o.id,o.invoice_no,o.customer_name,o.total_idr,o.work_status,
  case when o.refund_status='FULLY_REFUNDED' then 'REFUNDED'
       when o.total_idr=0 then 'ZERO_TOTAL'
       when coalesce(x.paid,0)=0 then 'UNPAID'
       when x.paid=o.total_idr then 'PAID' else 'PARTIAL' end::text,
  o.created_at
 from public.laundry_pos_orders o
 left join lateral (select coalesce(sum(p.amount_idr),0) as paid
   from public.laundry_pos_payments p where p.order_id=o.id and p.entry_type='RECEIPT') x on true
 where o.outlet_id=v_outlet and o.lifecycle_status='CONFIRMED'
 order by o.created_at desc,o.id desc limit 80;
end; $$;
revoke all on function laundry_private.pos_owner_board_read() from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_board_read() to authenticated;
create function public.laundry_pos_owner_order_board()
returns table(id uuid,invoice_no text,customer_name text,total_idr bigint,
 work_status text,payment_status text,created_at timestamptz)
language sql security invoker set search_path='' stable as $$
 select * from laundry_private.pos_owner_board_read();$$;
revoke all on function public.laundry_pos_owner_order_board() from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_order_board() to authenticated;
comment on function public.laundry_pos_owner_order_board() is
 'Read-only last 80 POS orders for active owner, distinct from passwordless cashier session.';

create function laundry_private.pos_owner_detail_read(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_owner uuid;v_outlet uuid;o record;v_paid bigint;v_items jsonb;
begin
 v_owner:=laundry_private.pos_owner_required();
 if p_order_id is null then return null;end if;
 select x.id into v_outlet from public.laundry_pos_outlets x where x.singleton_key=1 and x.active;
 select x.id,x.invoice_no,x.customer_name,x.total_idr,x.work_status,
  x.refund_status,x.perfume,x.notes,x.created_at
 into o from public.laundry_pos_orders x
 where x.id=p_order_id and x.outlet_id=v_outlet and x.lifecycle_status='CONFIRMED';
 if not found then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',i.service_name,'quantity_milli',i.quantity_milli,
  'unit',i.unit,'price_idr',i.price_idr,'total_idr',i.line_total_idr)
  order by i.line_number),'[]'::jsonb) into v_items
 from public.laundry_pos_order_items i where i.order_id=p_order_id;
 select coalesce(sum(p.amount_idr),0) into v_paid
 from public.laundry_pos_payments p where p.order_id=p_order_id and p.entry_type='RECEIPT';
 return jsonb_build_object(
 'invoice_no',o.invoice_no,'customer_name',o.customer_name,'total_idr',o.total_idr::text,
 'work_status',o.work_status,'created_at',o.created_at,'perfume',o.perfume,'notes',o.notes,
 'items',v_items,'paid_idr',v_paid::text,
 'remaining_idr',(case when o.refund_status='FULLY_REFUNDED' then 0
 else greatest(o.total_idr-v_paid,0) end)::text,
 'payment_status',case when o.refund_status='FULLY_REFUNDED' then 'REFUNDED'
 when o.total_idr=0 then 'ZERO_TOTAL' when v_paid=0 then 'UNPAID'
 when v_paid=o.total_idr then 'PAID' else 'PARTIAL' end);
end; $$;
revoke all on function laundry_private.pos_owner_detail_read(uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_detail_read(uuid) to authenticated;
create function public.laundry_pos_owner_order_detail(p_order_id uuid)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_owner_detail_read(p_order_id);$$;
revoke all on function public.laundry_pos_owner_order_detail(uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_order_detail(uuid) to authenticated;

create function laundry_private.pos_owner_cash_read()
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_owner uuid;v_outlet uuid;v_shift uuid;v_opening bigint;v_in bigint;v_out bigint;
begin
 v_owner:=laundry_private.pos_owner_required();
 select id into v_outlet from public.laundry_pos_outlets where singleton_key=1 and active;
 select id,opening_idr into v_shift,v_opening from public.laundry_pos_cash_shifts
 where outlet_id=v_outlet and register_code='MAIN' and closed_at is null limit 1;
 if v_shift is null then
  return jsonb_build_object('open',false,'opening_idr','0','cash_in_idr','0',
   'cash_out_idr','0','expected_cash_idr','0');
 end if;
 select coalesce(sum(case when direction='IN' and method='CASH' then amount_idr else 0 end),0),
        coalesce(sum(case when direction='OUT' and method='CASH' then amount_idr else 0 end),0)
 into v_in,v_out from public.laundry_pos_cash_ledger where shift_id=v_shift;
 return jsonb_build_object('open',true,'opening_idr',v_opening::text,'cash_in_idr',v_in::text,
 'cash_out_idr',v_out::text,'expected_cash_idr',(v_opening+v_in-v_out)::text);
end; $$;
revoke all on function laundry_private.pos_owner_cash_read() from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_cash_read() to authenticated;
create function public.laundry_pos_owner_cash_overview()
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_owner_cash_read();$$;
revoke all on function public.laundry_pos_owner_cash_overview() from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_cash_overview() to authenticated;

create function laundry_private.pos_owner_report_read(p_from date,p_until date)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_owner uuid;v_outlet uuid;v_start timestamptz;v_end timestamptz;
 v_orders bigint;v_cash_in bigint;v_cash_out bigint;v_noncash bigint;
begin
 v_owner:=laundry_private.pos_owner_required();
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>93
  then return null;end if;
 v_start:=p_from::timestamp at time zone 'Asia/Jakarta';
 v_end:=(p_until+1)::timestamp at time zone 'Asia/Jakarta';
 select id into v_outlet from public.laundry_pos_outlets where singleton_key=1 and active;
 select count(*) into v_orders from public.laundry_pos_orders
 where outlet_id=v_outlet and created_at>=v_start and created_at<v_end
  and lifecycle_status='CONFIRMED';
 select coalesce(sum(case when direction='IN' and method='CASH' then amount_idr else 0 end),0),
        coalesce(sum(case when direction='OUT' and method='CASH' then amount_idr else 0 end),0),
        coalesce(sum(case when direction='IN' and method='NONCASH' then amount_idr else 0 end),0)
 into v_cash_in,v_cash_out,v_noncash from public.laundry_pos_cash_ledger
 where outlet_id=v_outlet and occurred_at>=v_start and occurred_at<v_end;
 return jsonb_build_object('orders',v_orders,'cash_in_idr',v_cash_in::text,
 'cash_out_idr',v_cash_out::text,'noncash_in_idr',v_noncash::text);
end; $$;
revoke all on function laundry_private.pos_owner_report_read(date,date) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_report_read(date,date) to authenticated;
create function public.laundry_pos_owner_report_summary(p_from date,p_until date)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_owner_report_read(p_from,p_until);$$;
revoke all on function public.laundry_pos_owner_report_summary(date,date) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_report_summary(date,date) to authenticated;
-- Import, points, payments, order creation, and cash updates remain unchanged and disabled.
