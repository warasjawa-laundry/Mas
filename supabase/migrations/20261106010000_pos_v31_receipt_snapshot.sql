-- Read-only extension: no order, financial journal, point or pilot flag writes.
create function laundry_private.pos_v31_actor_label(p_owner uuid,p_staff uuid)
returns text language sql stable security definer set search_path='' as $$
 select coalesce((select nullif(btrim(s.display_name),'') from public.laundry_pos_staff s where s.staff_id=p_staff),'Owner MasJawa');
$$;
revoke all on function laundry_private.pos_v31_actor_label(uuid,uuid) from public,anon,authenticated;

-- Cancelled receipts must be readable as NEW documents, never as handover drafts.
-- Keep all existing outlet authorization and ledger calculations in the shared core.
do $migration$
declare body_v text;
begin
 select prosrc into strict body_v from pg_proc where oid='laundry_private.pos_v3_receipt_core(uuid,text,text,text,text)'::regprocedure;
 if position('o.lifecycle_status<>''CONFIRMED''' in body_v)=0 then raise exception 'Receipt lifecycle contract changed';end if;
 body_v:=replace(body_v,'o.lifecycle_status<>''CONFIRMED''',
  '(o.lifecycle_status not in (''CONFIRMED'',''CANCELLED'') or (o.lifecycle_status=''CANCELLED'' and p_kind<>''NEW''))');
 execute format('create or replace function laundry_private.pos_v3_receipt_core(p_order_id uuid,p_kind text,p_device_token text,p_login_token text,p_permission text) returns jsonb language plpgsql stable security definer set search_path='''' as %L',body_v);
end;$migration$;

create function laundry_private.pos_v31_receipt_snapshot(p_order_id uuid,p_kind text,p_device_token text,p_login_token text,p_permission text,p_audit boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base_v jsonb;o public.laundry_pos_orders%rowtype;payments_v jsonb:='[]';refunds_v jsonb:='[]';
 payment_v jsonb;payment_row record;collector_v text;version_v text;
begin
 if p_permission is null or p_permission not in ('order_view','whatsapp_draft') or p_audit is null or (p_audit and p_permission<>'order_view') then
  raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 base_v:=laundry_private.pos_v3_receipt_core(p_order_id,p_kind,p_device_token,p_login_token,p_permission);
 select * into strict o from public.laundry_pos_orders where id=p_order_id;
 select laundry_private.pos_v31_actor_label(e.actor_id,e.actor_staff_id) into collector_v
 from public.laundry_pos_order_events e where e.order_id=p_order_id and e.kind='WORK_STATUS_CHANGED' and e.data->>'to'='COLLECTED'
 order by e.occurred_at desc,e.id desc limit 1;
 for payment_row in select p.*,coalesce(m.method,source_m.method,p.method) as display_method,l.id as ledger_id
  from public.laundry_pos_payments p
  left join laundry_private.pos_v3_payment_methods m on m.payment_id=p.id
  left join laundry_private.pos_v3_payment_methods source_m on source_m.payment_id=p.original_receipt_id
  left join public.laundry_pos_cash_ledger l on l.payment_id=p.id
  where p.order_id=p_order_id order by p.confirmed_at,p.id
 loop
  payment_v:=jsonb_build_object('amount_idr',payment_row.amount_idr::text,'received_at',payment_row.confirmed_at,
   'receiver',laundry_private.pos_v31_actor_label(payment_row.confirmed_by,payment_row.confirmed_staff_id),'method',payment_row.display_method);
  if p_audit then
   payment_v:=payment_v||jsonb_build_object('payment_id',payment_row.id,'internal_reference',payment_row.command_id,
    'cash_ledger_id',payment_row.ledger_id,'original_receipt_id',payment_row.original_receipt_id);
  end if;
  if payment_row.entry_type='RECEIPT' then payments_v:=payments_v||jsonb_build_array(payment_v);
  else refunds_v:=refunds_v||jsonb_build_array(payment_v);end if;
 end loop;
 -- Payments and method snapshots are append-only; this token changes on every new record.
 select count(*)::text into version_v from public.laundry_pos_payments where order_id=p_order_id;
 base_v:=base_v||jsonb_build_object('order_id',o.id,'order_version',o.version::text,
  'payment_version',version_v,'snapshot_at',statement_timestamp(),'lifecycle_status',o.lifecycle_status,
  'actor',laundry_private.pos_v31_actor_label(o.created_by,o.created_staff_id),'collector',collector_v,
  'payments',payments_v,'refunds',refunds_v);
 if o.is_test_order then
  base_v:=base_v||jsonb_build_object('point_simulation',public.laundry_pos_point_simulation(p_order_id,null,null,null,p_device_token,p_login_token));
 end if;
 if o.lifecycle_status='CANCELLED' then
  base_v:=base_v||jsonb_build_object('status',case when o.refund_status='FULLY_REFUNDED' then 'REFUNDED' else 'CANCELLED' end,'work_status','CANCELLED','remaining','0');
 elsif base_v->>'status'='REFUNDED' then base_v:=base_v||jsonb_build_object('remaining','0');end if;
 return base_v;
end;$$;
revoke all on function laundry_private.pos_v31_receipt_snapshot(uuid,text,text,text,text,boolean) from public,anon,authenticated;

create or replace function public.laundry_pos_v31_whatsapp_receipt(p_order_id uuid,p_kind text,p_device_token text default null,p_login_token text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select laundry_private.pos_v31_receipt_snapshot(p_order_id,p_kind,p_device_token,p_login_token,'whatsapp_draft',false);
$$;
revoke all on function public.laundry_pos_v31_whatsapp_receipt(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v31_whatsapp_receipt(uuid,text,text,text) to anon,authenticated;

create or replace function public.laundry_pos_v31_print_receipt(p_order_id uuid,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_device_token is not null or p_login_token is not null then
  if not exists(select 1 from laundry_private.pos_cashier_logged_in(p_device_token,p_login_token) s where coalesce((s.permissions->>'receipt_print')::boolean,false)) then
   raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 end if;
 return laundry_private.pos_v31_receipt_snapshot(p_order_id,'NEW',p_device_token,p_login_token,'order_view',false);
end;$$;
revoke all on function public.laundry_pos_v31_print_receipt(uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v31_print_receipt(uuid,text,text) to anon,authenticated;

-- Older application builds validate this accounting balance even after refund/cancellation.
create or replace function public.laundry_pos_whatsapp_receipt(p_order_id uuid,p_kind text,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare legacy_v jsonb;
begin
 legacy_v:=public.laundry_pos_v31_whatsapp_receipt(p_order_id,p_kind,p_device_token,p_login_token);
 return legacy_v||jsonb_build_object('remaining',greatest(0,(legacy_v->>'total')::bigint-(legacy_v->>'paid')::bigint+(legacy_v->>'refunded')::bigint)::text);
end;$$;
revoke all on function public.laundry_pos_whatsapp_receipt(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_whatsapp_receipt(uuid,text,text,text) to anon,authenticated;

create or replace function public.laundry_pos_print_receipt(p_order_id uuid,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare legacy_v jsonb;
begin
 legacy_v:=public.laundry_pos_v31_print_receipt(p_order_id,p_device_token,p_login_token);
 return legacy_v||jsonb_build_object('remaining',greatest(0,(legacy_v->>'total')::bigint-(legacy_v->>'paid')::bigint+(legacy_v->>'refunded')::bigint)::text);
end;$$;
revoke all on function public.laundry_pos_print_receipt(uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_print_receipt(uuid,text,text) to anon,authenticated;

create function public.laundry_pos_order_audit(p_order_id uuid,p_device_token text default null,p_login_token text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select laundry_private.pos_v31_receipt_snapshot(p_order_id,'NEW',p_device_token,p_login_token,'order_view',true);
$$;
revoke all on function public.laundry_pos_order_audit(uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_order_audit(uuid,text,text) to anon,authenticated;
