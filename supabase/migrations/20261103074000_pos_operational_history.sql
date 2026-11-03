-- Read-only operational history; callers enforce owner/session and outlet scope.
create function laundry_private.pos_order_timeline(p_order_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind',e.kind,'at',e.occurred_at,'actor_id',e.actor_id,'actor_staff_id',e.actor_staff_id,
 'actor',coalesce(s.display_name,'Owner '||e.actor_id::text),'reason',e.reason,'from',e.data->>'from','to',e.data->>'to') order by e.occurred_at),'[]'::jsonb)
 from public.laundry_pos_order_events e left join public.laundry_pos_staff s on s.staff_id=e.actor_staff_id
 where e.order_id=p_order_id and e.kind in ('ORDER_CREATED','WORK_STATUS_CHANGED','ORDER_CANCELLED');
$$;
revoke all on function laundry_private.pos_order_timeline(uuid) from public,anon,authenticated;
create or replace function laundry_private.pos_owner_order_detail(p_order_id uuid)
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
  'created_at',o.created_at,'due_at',o.due_at,'eta_status',o.eta_status,
  'lifecycle_status',o.lifecycle_status,'perfume',o.perfume,'notes',o.notes,
  'ready_at',o.ready_at,'collected_at',o.collected_at,'events',laundry_private.pos_order_timeline(o.id),
  'created_by',o.created_by,'created_staff_id',o.created_staff_id,
  'items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'service_name',i.service_name,'unit',i.unit,'quantity_milli',i.quantity_milli,
   'price_idr',i.price_idr,'line_total_idr',i.line_total_idr,'category',i.category_snapshot,
   'package_name',i.package_snapshot,'catalog_revision',i.catalog_revision,
   'duration',i.duration_label,'duration_minutes',i.duration_minutes,'due_at',i.due_at) order by i.line_number)
    from public.laundry_pos_order_items i where i.order_id=o.id),'[]'::jsonb)
 ) into v_row
 from public.laundry_pos_orders o
 join public.laundry_pos_outlets outlet on outlet.id=o.outlet_id and outlet.singleton_key=1
 left join lateral(select coalesce(sum(p.amount_idr),0) as paid
  from public.laundry_pos_payments p where p.order_id=o.id and p.entry_type='RECEIPT') x on true
 where o.id=p_order_id;
 return v_row;
end; $$;
revoke all on function laundry_private.pos_owner_order_detail(uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_order_detail(uuid) to authenticated;
create or replace function public.laundry_pos_owner_order_detail(p_order_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_order_detail(p_order_id); $$;
revoke all on function public.laundry_pos_owner_order_detail(uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_order_detail(uuid) to authenticated;

create or replace function laundry_private.pos_g4_order_detail(
 p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare a record; v_order record; v_lines jsonb;
begin
 select z.staff_id,z.outlet_id into a
 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false) z;
 select o.id,o.invoice_no,o.customer_name,o.total_idr,o.work_status,
    o.lifecycle_status,o.created_at,o.perfume,o.notes,o.created_by,o.created_staff_id,o.due_at,o.eta_status,o.ready_at,o.collected_at
 into v_order from public.laundry_pos_orders o
 where o.id=p_order_id and o.outlet_id=a.outlet_id;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='22023'; end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'service_name',i.service_name,'unit',i.unit,'quantity_milli',i.quantity_milli,
     'price_idr',i.price_idr,'line_total_idr',i.line_total_idr,'category',i.category_snapshot,
   'package_name',i.package_snapshot,'catalog_revision',i.catalog_revision,
   'duration',i.duration_label,'duration_minutes',i.duration_minutes,'due_at',i.due_at) order by i.line_number), '[]'::jsonb)
 into v_lines from public.laundry_pos_order_items i where i.order_id=p_order_id;
 return pg_catalog.jsonb_build_object('id',v_order.id,'invoice_no',v_order.invoice_no,
    'customer_name',v_order.customer_name,'total_idr',v_order.total_idr::text,
    'work_status',v_order.work_status,'lifecycle_status',v_order.lifecycle_status,
    'created_at',v_order.created_at,'perfume',v_order.perfume,'notes',v_order.notes,
    'ready_at',v_order.ready_at,'collected_at',v_order.collected_at,'events',laundry_private.pos_order_timeline(p_order_id),
    'created_by',v_order.created_by,'due_at',v_order.due_at,'eta_status',v_order.eta_status,
    'created_staff_id',v_order.created_staff_id,'items',v_lines);
end;
$$;
revoke all on function laundry_private.pos_g4_order_detail(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_order_detail(text,text,uuid) to anon,authenticated;
create or replace function public.laundry_pos_g4_order_detail(p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_g4_order_detail(p_device_token,p_login_token,p_order_id);
$$;
revoke all on function public.laundry_pos_g4_order_detail(text,text,uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_order_detail(text,text,uuid) to anon,authenticated;
