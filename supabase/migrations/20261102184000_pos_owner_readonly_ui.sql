-- G8 NO-GO: additive READ-ONLY owner POS RPCs. Apply QA only, never Production before approval.
-- Owner auth is verified inside non-exposed security-definer functions, not via cashier tokens.
create function laundry_private.pos_owner_order_board()
returns table (id uuid,invoice_no text,customer_name text,total_idr bigint,
 work_status text,payment_status text,created_at timestamptz)
language plpgsql security definer set search_path='' stable as $$
begin
 perform laundry_private.pos_owner_required();
 return query select o.id,o.invoice_no,o.customer_name,o.total_idr,o.work_status,
  (case when o.refund_status='FULLY_REFUNDED' then 'REFUNDED'
    when o.total_idr=0 then 'ZERO_TOTAL'
    when coalesce(x.paid,0)=0 then 'UNPAID'
    when x.paid=o.total_idr then 'PAID' else 'PARTIAL' end)::text,o.created_at
 from public.laundry_pos_orders o
 join public.laundry_pos_outlets outlet on outlet.id=o.outlet_id and outlet.singleton_key=1
 left join lateral(select coalesce(sum(p.amount_idr),0) as paid
  from public.laundry_pos_payments p where p.order_id=o.id and p.entry_type='RECEIPT') x on true
 where o.lifecycle_status='CONFIRMED'
 order by o.created_at desc,o.id desc limit 80;
end; $$;
revoke all on function laundry_private.pos_owner_order_board() from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_order_board() to authenticated;
create function public.laundry_pos_owner_order_board()
returns table (id uuid,invoice_no text,customer_name text,total_idr bigint,
 work_status text,payment_status text,created_at timestamptz)
language sql security invoker set search_path='' stable as $$
 select * from laundry_private.pos_owner_order_board(); $$;
revoke all on function public.laundry_pos_owner_order_board() from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_order_board() to authenticated;

create function laundry_private.pos_owner_order_detail(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_row jsonb;
begin
 perform laundry_private.pos_owner_required();
 if p_order_id is null then return null;end if;
 select pg_catalog.jsonb_build_object(
  'id',o.id,'invoice_no',o.invoice_no,'customer_name',o.customer_name,
  'total_idr',o.total_idr::text,'work_status',o.work_status,
  'payment_status',case when o.refund_status='FULLY_REFUNDED' then 'REFUNDED'
    when o.total_idr=0 then 'ZERO_TOTAL'
    when coalesce(x.paid,0)=0 then 'UNPAID'
    when x.paid=o.total_idr then 'PAID' else 'PARTIAL' end,
  'created_at',o.created_at,
  'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'service_name',i.service_name,'unit',i.unit,'quantity_milli',i.quantity_milli,
   'price_idr',i.price_idr,'line_total_idr',i.line_total_idr) order by i.line_number)
    from public.laundry_pos_order_items i where i.order_id=o.id),'[]'::jsonb)
 ) into v_row
 from public.laundry_pos_orders o
 join public.laundry_pos_outlets outlet on outlet.id=o.outlet_id and outlet.singleton_key=1
 left join lateral(select coalesce(sum(p.amount_idr),0) as paid
  from public.laundry_pos_payments p where p.order_id=o.id and p.entry_type='RECEIPT') x on true
 where o.id=p_order_id and o.lifecycle_status='CONFIRMED';
 return v_row;
end; $$;
revoke all on function laundry_private.pos_owner_order_detail(uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_order_detail(uuid) to authenticated;
create function public.laundry_pos_owner_order_detail(p_order_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_order_detail(p_order_id); $$;
revoke all on function public.laundry_pos_owner_order_detail(uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_order_detail(uuid) to authenticated;
