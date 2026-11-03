-- Additive pilot document boundary; keeps existing owner/session authorization and ledger state.
create or replace function laundry_private.pos_owner_order_detail(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_row jsonb;
begin
 perform laundry_private.pos_owner_required();
 if p_order_id is null then return null;end if;
 select pg_catalog.jsonb_build_object(
  'is_test_order',o.is_test_order,'service_subtotal_idr',o.service_subtotal_idr::text,'fees_idr',o.fees_idr::text,
  'delivery',case when o.delivery_code_snapshot is null then null else jsonb_build_object('code',o.delivery_code_snapshot,'name',o.delivery_name_snapshot,'amount_idr',o.delivery_fee_idr::text) end,'id',o.id,'invoice_no',o.invoice_no,'customer_name',o.customer_name,
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

create or replace function laundry_private.pos_g4_order_detail(
 p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare a record; v_order record; v_lines jsonb;
begin
 select z.staff_id,z.outlet_id into a
 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false) z;
 select o.is_test_order,o.service_subtotal_idr,o.fees_idr,o.delivery_code_snapshot,o.delivery_name_snapshot,o.delivery_fee_idr,o.id,o.invoice_no,o.customer_name,o.total_idr,o.work_status,
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
 return pg_catalog.jsonb_build_object('is_test_order',v_order.is_test_order,'service_subtotal_idr',v_order.service_subtotal_idr::text,'fees_idr',v_order.fees_idr::text,
    'delivery',case when v_order.delivery_code_snapshot is null then null else jsonb_build_object('code',v_order.delivery_code_snapshot,'name',v_order.delivery_name_snapshot,'amount_idr',v_order.delivery_fee_idr::text) end,'id',v_order.id,'invoice_no',v_order.invoice_no,
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

create or replace function public.laundry_pos_whatsapp_receipt(p_order_id uuid,p_kind text,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_id uuid; staff uuid; outlet uuid; o record; paid bigint; refunded bigint; status text;
 year_v integer; balance bigint; awarded integer; projected integer; tier jsonb; member_data jsonb; contact_v jsonb; actor text; collector text;
begin
 if p_device_token is null and p_login_token is null then owner_id:=laundry_private.pos_owner_required();outlet:=laundry_private.pos_owner_outlet();
 else select z.staff_id,z.outlet_id into staff,outlet from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'whatsapp_draft',false) z;end if;
 select * into o from public.laundry_pos_orders where id=p_order_id and outlet_id=outlet;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('NEW','READY','COLLECTED') or o.lifecycle_status<>'CONFIRMED'
 or (p_kind='READY' and o.work_status<>'READY') or (p_kind='COLLECTED' and o.work_status<>'COLLECTED') then raise exception 'receipt_status_invalid';end if;
 select coalesce(sum(amount_idr) filter(where entry_type='RECEIPT'),0),coalesce(sum(amount_idr) filter(where entry_type='REFUND'),0)
 into paid,refunded from public.laundry_pos_payments where order_id=p_order_id;
 status:=case when refunded>0 or o.refund_status<>'NONE' then 'REFUNDED' when o.total_idr=0 then 'ZERO_TOTAL'
 when paid=0 then 'UNPAID' when paid=o.total_idr then 'PAID' else 'PARTIAL' end;
 if p_kind='COLLECTED' and status<>'PAID' then raise exception 'receipt_status_invalid';end if;
 if o.member_id is not null then
  select p.program_year,p.awarded_points into year_v,awarded from public.laundry_pos_point_links p where p.order_id=p_order_id and p.link_type='ADD';
  year_v:=coalesce(year_v,extract(year from timezone('Asia/Jakarta',statement_timestamp()))::integer);
  select coalesce(sum(t.awarded_points),0) into balance from public.laundry_amount_transactions t where t.member_id=o.member_id and t.program_year=year_v
   and not exists(select 1 from public.laundry_checklist_events e where e.event_type='VOID' and e.reverses_event_id=t.visit_event_id);
  if status in ('UNPAID','PARTIAL') then
   for tier in select value from public.laundry_point_rules r cross join lateral jsonb_array_elements(r.tiers) where r.program_year=year_v order by (value->>'minimum')::bigint loop
    projected:=coalesce(projected,0);if o.total_idr >= (tier->>'minimum')::bigint then projected:=(tier->>'points')::integer;end if;
   end loop;
  end if;
  member_data:=jsonb_build_object('year',year_v,'balance',balance::text,'awarded',case when status='PAID' then coalesce(awarded,0) else 0 end,'projected',projected);
 end if;
 select jsonb_build_object('phone',c.phone,'address',c.address,'verified_at',c.verified_at) into contact_v
 from laundry_private.pos_order_contacts c where c.order_id=p_order_id order by c.id desc limit 1;
 select s.display_name into actor from public.laundry_pos_staff s where s.staff_id=o.created_staff_id;
 actor:=coalesce(actor,'Owner '||o.created_by::text);
 select coalesce(s.display_name,'Owner '||e.actor_id::text) into collector from public.laundry_pos_order_events e
 left join public.laundry_pos_staff s on s.staff_id=e.actor_staff_id
 where e.order_id=p_order_id and e.kind='WORK_STATUS_CHANGED' and e.data->>'to'='COLLECTED' order by e.occurred_at desc limit 1;
 return jsonb_build_object('is_test_order',o.is_test_order,'invoice',o.invoice_no,'customer',o.customer_name,'actor',actor,'contact',case when o.is_test_order then null else contact_v end,
 'collector',collector,'kind',p_kind,'created_at',o.created_at,'due_at',o.due_at,'ready_at',o.ready_at,'collected_at',o.collected_at,'work_status',o.work_status,
 'package',o.package_name_snapshot,'minutes',o.package_minutes_snapshot,'perfume',o.perfume,'notes',o.notes,
 'service_subtotal',o.service_subtotal_idr::text,'fees_idr',o.fees_idr::text,'discount_idr',o.discount_idr::text,
 'delivery',case when o.delivery_code_snapshot is null then null else jsonb_build_object('code',o.delivery_code_snapshot,'name',o.delivery_name_snapshot,'amount_idr',o.delivery_fee_idr::text) end,
 'total',o.total_idr::text,'paid',paid::text,'refunded',refunded::text,'remaining',greatest(0,o.total_idr-paid+refunded)::text,'status',status,'member',member_data,
 'settings',(select jsonb_build_object('revision',s.revision,'config',s.config) from laundry_private.pos_receipt_settings s),
 'items',(select jsonb_agg(jsonb_build_object('name',i.service_name,'package',i.package_snapshot,'duration',i.duration_label,'quantity_milli',i.quantity_milli,
 'unit',i.unit,'price',i.price_idr::text,'subtotal',i.line_total_idr::text) order by i.line_number) from public.laundry_pos_order_items i where i.order_id=p_order_id));
end; $$;
revoke all on function public.laundry_pos_whatsapp_receipt(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_whatsapp_receipt(uuid,text,text,text) to anon,authenticated;

create function laundry_private.pos_test_contact_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.laundry_pos_orders o where o.id=new.order_id and o.is_test_order) then
  raise exception 'POS_TEST_CONTACT_FORBIDDEN' using errcode='22023';
 end if;
 return new;
end; $$;
revoke all on function laundry_private.pos_test_contact_guard() from public,anon,authenticated;
create trigger pos_test_contact_guard before insert on laundry_private.pos_order_contacts
 for each row execute function laundry_private.pos_test_contact_guard();
