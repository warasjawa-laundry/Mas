-- Additive read API. Rollback: drop only this function; V3 remains available.
-- STABLE queries share the calling statement's MVCC snapshot, including authorization.
create function public.laundry_pos_v32_report(p_start timestamptz,p_end timestamptz,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner_v uuid;staff_v uuid;outlet_v uuid;can_view boolean:=true;ids_v uuid[];
 orders_v jsonb:='[]';items_v jsonb:='[]';cash_v jsonb;activity_v jsonb;summary_v jsonb;recon_v jsonb;
 seed_v numeric;opening_v numeric;in_v numeric;out_v numeric;physical_v jsonb;seed_at timestamptz;
begin
 if p_device_token is null and p_login_token is null then
  owner_v:=laundry_private.pos_owner_required();outlet_v:=laundry_private.pos_owner_outlet();
 else
  select staff_id,outlet_id into staff_v,outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'reports_view',false);
  select coalesce((permissions->>'order_view')::boolean,false) into can_view from public.laundry_pos_staff_outlets where staff_id=staff_v and outlet_id=outlet_v;
 end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start or p_end>p_start+interval '93 days' then
  raise exception 'POS_REPORT_INTERVAL_INVALID' using errcode='22023';end if;
 -- Financial cores write one event timestamp and amount to both immutable journals.
 -- Refuse inconsistent history rather than assign a payment to a different period.
 -- Historical receipts/refunds also support the opening book balance. The unique
 -- ledger.payment_id constraint supplies at most one row; this check requires one.
 if exists(select 1 from public.laundry_pos_orders o join public.laundry_pos_payments p on p.order_id=o.id
  where o.outlet_id=outlet_v and p.confirmed_at<p_end
   and not exists(select 1 from public.laundry_pos_cash_ledger l where l.payment_id=p.id)) then
  raise exception 'POS_REPORT_INTEGRITY' using errcode='22023';end if;
 if exists(select 1 from public.laundry_pos_cash_ledger l join public.laundry_pos_payments p on p.id=l.payment_id
  where l.outlet_id=outlet_v and (l.occurred_at<p_end or p.confirmed_at<p_end)
   and (l.occurred_at<>p.confirmed_at or l.amount_idr<>p.amount_idr or l.method<>p.method or l.outlet_id<>p.outlet_id
    or l.category<>case p.entry_type when 'RECEIPT' then 'PAYMENT' else 'REFUND' end
    or l.direction<>case p.entry_type when 'RECEIPT' then 'IN' else 'OUT' end)) then
  raise exception 'POS_REPORT_INTEGRITY' using errcode='22023';end if;
 select coalesce(array_agg(o.id),'{}'::uuid[]) into ids_v from public.laundry_pos_orders o where o.outlet_id=outlet_v and
  ((o.created_at>=p_start and o.created_at<p_end) or exists(select 1 from public.laundry_pos_payments p where p.order_id=o.id and p.confirmed_at>=p_start and p.confirmed_at<p_end)
   or exists(select 1 from public.laundry_pos_payments p join public.laundry_pos_cash_ledger l on l.payment_id=p.id
    where p.order_id=o.id and l.occurred_at>=p_start and l.occurred_at<p_end));
 if cardinality(ids_v)>1000 or (select count(*) from public.laundry_pos_order_items where order_id=any(ids_v))>30000
  or (select count(*) from public.laundry_pos_cash_ledger where outlet_id=outlet_v and occurred_at>=p_start and occurred_at<p_end)>5000 then
  raise exception 'POS_REPORT_LIMIT' using errcode='22023';end if;
 if can_view then
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'invoice',o.invoice_no,'created_at',o.created_at,
   'customer',o.customer_name,'customer_id',coalesce(o.member_id,o.guest_id),'member_id',o.member_id,'guest_id',o.guest_id,
   'customer_kind',case when o.member_id is not null then 'MEMBER' else 'GUEST' end,
   'creator',laundry_private.pos_v31_actor_label(o.created_by,o.created_staff_id),'created_in_period',o.created_at>=p_start and o.created_at<p_end,
   'subtotal',o.service_subtotal_idr::text,'discount',o.discount_idr::text,'fees',o.fees_idr::text,'total',o.total_idr::text,
   'paid',coalesce(p.paid,0)::text,'refunded',coalesce(p.refunded,0)::text,
   'remaining',case when o.refund_status='FULLY_REFUNDED' or o.lifecycle_status='CANCELLED' then '0' else greatest(o.total_idr-coalesce(p.paid,0),0)::text end,
   'status',case when o.lifecycle_status='CANCELLED' then 'CANCELLED' when o.refund_status='FULLY_REFUNDED' then 'REFUNDED' when o.total_idr=0 then 'ZERO_TOTAL' when coalesce(p.paid,0)=o.total_idr then 'PAID' when coalesce(p.paid,0)>0 then 'PARTIAL' else 'UNPAID' end,
   'lifecycle_status',o.lifecycle_status,'work_status',o.work_status,'refund_status',o.refund_status,'is_test_order',o.is_test_order)
   ||laundry_private.pos_v31_item_summary(o.id) order by o.created_at,o.id),'[]') into orders_v
  from public.laundry_pos_orders o left join lateral(select sum(amount_idr) filter(where entry_type='RECEIPT') paid,sum(amount_idr) filter(where entry_type='REFUND') refunded from public.laundry_pos_payments where order_id=o.id)p on true where o.id=any(ids_v);
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'line_number',i.line_number,'order_id',i.order_id,'invoice',o.invoice_no,'name',i.service_name,
   'package',i.package_snapshot,'quantity_milli',i.quantity_milli,'unit',i.unit,'price',i.price_idr::text,'subtotal',i.line_total_idr::text,
   'created_in_period',o.created_at>=p_start and o.created_at<p_end) order by o.created_at,o.id,i.line_number),'[]') into items_v
  from public.laundry_pos_order_items i join public.laundry_pos_orders o on o.id=i.order_id where o.id=any(ids_v);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'command_id',l.command_id,'payment_id',case when can_view then p.id end,
  'original_receipt_id',case when can_view then p.original_receipt_id end,'order_id',case when can_view then p.order_id end,
  'invoice',case when can_view then o.invoice_no end,'customer',case when can_view then o.customer_name end,
  'at',l.occurred_at,'direction',l.direction,'category',l.category,'method',coalesce(t.method,l.method),'amount',l.amount_idr::text,
  'actor',laundry_private.pos_v31_actor_label(l.created_by,l.created_staff_id),'note',case when can_view or l.payment_id is null then l.note end,
  'is_test_order',o.is_test_order)||laundry_private.pos_v31_cash_metadata_json(l.command_id)||jsonb_build_object(
  'accounting_classification',case when l.category in ('PAYMENT','REFUND') then l.category else coalesce(c.classification,'UNCLASSIFIED') end)
  order by l.occurred_at,l.id),'[]') into cash_v
 from public.laundry_pos_cash_ledger l left join public.laundry_pos_payments p on p.id=l.payment_id
 left join laundry_private.pos_v3_payment_methods t on t.payment_id=coalesce(p.original_receipt_id,p.id)
 left join public.laundry_pos_orders o on o.id=p.order_id
 left join laundry_private.pos_v31_cash_metadata m on m.request_id=l.command_id
 left join laundry_private.pos_v31_cash_categories c on c.code=m.category_code
 where l.outlet_id=outlet_v and l.occurred_at>=p_start and l.occurred_at<p_end;
 select coalesce(jsonb_agg(jsonb_build_object('date',a.report_day,'order_count',a.orders,'order_total',a.total::text,'unique_customer_count',a.customers,
  'identified_member_count',a.members,'guest_order_count',a.guests,'service_item_count',a.items,'quantities_milli',jsonb_build_object('kg',a.kg,'m',a.m,'pcs',a.pcs)) order by a.report_day),'[]') into activity_v
 from(select (o.created_at at time zone 'Asia/Jakarta')::date report_day,count(*) orders,sum(o.total_idr) total,
  case when count(o.guest_id)=0 then count(distinct o.member_id) end customers,
  count(distinct o.member_id) members,count(o.guest_id) guests,
  sum(i.items) items,sum(i.kg) kg,sum(i.m) m,sum(i.pcs) pcs
  from public.laundry_pos_orders o cross join lateral(select count(*) items,
   coalesce(sum(quantity_milli) filter(where unit='kg'),0) kg,coalesce(sum(quantity_milli) filter(where unit='m'),0) m,
   coalesce(sum(quantity_milli) filter(where unit='pcs'),0) pcs from public.laundry_pos_order_items where order_id=o.id)i
  where o.outlet_id=outlet_v and o.created_at>=p_start and o.created_at<p_end group by 1)a;
 select jsonb_build_object('order_count',count(*),'order_total',coalesce(sum(o.total_idr),0)::text,
  'unique_customer_count',case when count(o.guest_id)=0 then count(distinct o.member_id) end,
  'identified_member_count',count(distinct o.member_id),'guest_order_count',count(o.guest_id),
  'service_item_count',coalesce(sum(i.items),0),'quantities_milli',jsonb_build_object('kg',coalesce(sum(i.kg),0),'m',coalesce(sum(i.m),0),'pcs',coalesce(sum(i.pcs),0))) into summary_v
 from public.laundry_pos_orders o cross join lateral(select count(*) items,coalesce(sum(quantity_milli) filter(where unit='kg'),0) kg,
  coalesce(sum(quantity_milli) filter(where unit='m'),0) m,coalesce(sum(quantity_milli) filter(where unit='pcs'),0) pcs from public.laundry_pos_order_items where order_id=o.id)i
 where o.outlet_id=outlet_v and o.created_at>=p_start and o.created_at<p_end;
 if owner_v is not null then
  select opening_idr,opened_at into seed_v,seed_at from public.laundry_pos_cash_shifts where outlet_id=outlet_v and register_code='MAIN' order by opened_at,id limit 1;
  -- Subsequent automatic shifts carry the balance; adding them would double count cash.
  select coalesce(seed_v,0)*case when seed_at<p_start then 1 else 0 end+coalesce(sum(case direction when 'IN' then amount_idr else -amount_idr end),0) into opening_v
   from public.laundry_pos_cash_ledger where outlet_id=outlet_v and method='CASH' and occurred_at<p_start;
  select coalesce(sum(amount_idr) filter(where direction='IN'),0),coalesce(sum(amount_idr) filter(where direction='OUT'),0) into in_v,out_v
   from public.laundry_pos_cash_ledger where outlet_id=outlet_v and method='CASH' and occurred_at>=p_start and occurred_at<p_end;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.request_id,'at',r.occurred_at,'owner',laundry_private.pos_v31_actor_label(r.owner_id,null),
   'expected',r.expected_idr::text,'counted',r.counted_idr::text,'difference',(r.counted_idr-r.expected_idr)::text,'reason',r.reason,'is_test',r.is_test)),'[]') into physical_v
   from(select * from laundry_private.pos_cash_reconciliations where outlet_id=outlet_v order by occurred_at desc,request_id desc limit 1)r;
  recon_v:=jsonb_build_object('available',true,'scope','PERIOD_CASH_BOOK','opening_cash',opening_v::text,'cash_in',in_v::text,'cash_out',out_v::text,
   'opening_seed_in_period',case when seed_at>=p_start and seed_at<p_end then seed_v else 0 end::text,
   'closing_cash',(opening_v+in_v-out_v+case when seed_at>=p_start and seed_at<p_end then seed_v else 0 end)::text,
   'physical_checks',physical_v,'physical_scope','OBSERVATION_TIME','status',case when jsonb_array_length(physical_v)=0 then 'BELUM DIVERIFIKASI' else 'TERSEDIA' end);
 else recon_v:=jsonb_build_object('available',false,'physical_checks','[]'::jsonb,'status','OWNER_ONLY');end if;
 return jsonb_build_object('schema_version',32,'start',p_start,'end',p_end,'snapshot_at',statement_timestamp(),'timezone','Asia/Jakarta',
  'outlet',(select jsonb_build_object('id',id,'code',code,'name',name) from public.laundry_pos_outlets where id=outlet_v),
  'pilot_test_only',(select pilot_test_only from public.laundry_pos_outlets where id=outlet_v),'balance_scope','CURRENT','can_view_orders',can_view,
  'orders',orders_v,'items',items_v,'cash',cash_v,'summary',summary_v,'period_activity',activity_v,'cash_reconciliation',recon_v,
  'completeness',jsonb_build_object('complete',true,'truncated',false,'historical_receivables','UNAVAILABLE','order_state','CURRENT','customer_identity','MEMBER_STABLE_GUEST_PER_ORDER',
   'limits',jsonb_build_object('orders',1000,'cash',5000,'items',30000)));
end;$$;
revoke all on function public.laundry_pos_v32_report(timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v32_report(timestamptz,timestamptz,text,text) to anon,authenticated;
