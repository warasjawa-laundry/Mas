-- G4: One-outlet POS order creation, staff attribution, read/transition commands.
-- No payments, no points, and no production rollout. SQL direct table access remains denied.
-- Legacy auth.user attribution is retained; newly-created cashier notes use actual staff FK.

alter table public.laundry_pos_orders alter column created_by drop not null;
alter table public.laundry_pos_orders add column created_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_pos_orders add constraint pos_orders_exactly_one_actor
  check ((created_by is null) <> (created_staff_id is null));
create index pos_orders_staff_created_idx on public.laundry_pos_orders(created_staff_id,created_at desc);

alter table public.laundry_pos_commands alter column actor_id drop not null;
alter table public.laundry_pos_commands add column actor_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_pos_commands add constraint pos_commands_exactly_one_actor
  check ((actor_id is null) <> (actor_staff_id is null));
create index pos_commands_staff_idx on public.laundry_pos_commands(actor_staff_id,committed_at desc);

alter table public.laundry_pos_order_events alter column actor_id drop not null;
alter table public.laundry_pos_order_events add column actor_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_pos_order_events add constraint pos_events_exactly_one_actor
  check ((actor_id is null) <> (actor_staff_id is null));

alter table public.laundry_pos_guest_customers alter column created_by drop not null;
alter table public.laundry_pos_guest_customers add column created_staff_id uuid references public.laundry_pos_staff(staff_id) on delete restrict;
alter table public.laundry_pos_guest_customers add constraint pos_guests_exactly_one_actor
  check ((created_by is null) <> (created_staff_id is null));

-- Verify two live credentials, role and dynamically assigned permission on EVERY call.
create function laundry_private.pos_g4_cashier_authorize(
 p_device_token text, p_login_token text, p_permission text, p_write boolean default false)
returns table (staff_id uuid, outlet_id uuid, staff_username text)
language plpgsql security definer set search_path='' stable as $$
declare v_session record;
begin
 if p_permission not in ('order_view','order_create','order_work','member_lookup') then
   raise exception 'POS_PERMISSION_INVALID' using errcode='42501';
 end if;
 select s.staff_id,s.outlet_id,s.username,s.permissions,s.write_enabled
   into v_session
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

-- Cashier read-only catalog snapshots, no raw DB table privileges granted.
create function laundry_private.pos_g4_catalog(p_device_token text,p_login_token text)
returns table(id uuid,category text,package_name text,name text,price_idr bigint,unit text,duration text,revision bigint)
language plpgsql security definer set search_path='' stable as $$
begin
 perform 1 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false);
 return query select s.id,s.category,s.package_name,s.name,s.price_idr,s.unit,s.duration,s.revision
   from public.laundry_services s where s.is_visible and s.price_idr>=0 and s.price_idr<=1000000000
   and s.unit in ('kg','m','M','meter','pcs','satuan')
   order by s.position,s.category,s.name,s.id limit 250;
end;
$$;
revoke all on function laundry_private.pos_g4_catalog(text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_catalog(text,text) to anon,authenticated;
create function public.laundry_pos_g4_catalog(p_device_token text,p_login_token text)
returns table(id uuid,category text,package_name text,name text,price_idr bigint,unit text,duration text,revision bigint)
language sql security invoker set search_path='' stable as $$
 select * from laundry_private.pos_g4_catalog(p_device_token,p_login_token);
$$;
revoke all on function public.laundry_pos_g4_catalog(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_catalog(text,text) to anon,authenticated;

-- Exact member number only, not name search/PII enumeration. Supports selecting an
-- existing customer without changing their QR, membership, or points.
create function laundry_private.pos_g4_member_number(p_device_token text,p_login_token text,p_member_number text)
returns table(id uuid,member_number bigint,display_name text)
language plpgsql security definer set search_path='' stable as $$
begin
 perform 1 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'member_lookup',false);
 if p_member_number is null or p_member_number !~ '^[1-9][0-9]{0,11}$' then return; end if;
 return query select m.id,m.member_number,m.display_name from public.laundry_members m
   where m.member_number=p_member_number::bigint and m.is_active limit 1;
end;
$$;
revoke all on function laundry_private.pos_g4_member_number(text,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_member_number(text,text,text) to anon,authenticated;
create function public.laundry_pos_g4_member_number(p_device_token text,p_login_token text,p_member_number text)
returns table(id uuid,member_number bigint,display_name text)
language sql security invoker set search_path='' stable as $$
 select * from laundry_private.pos_g4_member_number(p_device_token,p_login_token,p_member_number);
$$;
revoke all on function public.laundry_pos_g4_member_number(text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_member_number(text,text,text) to anon,authenticated;

-- Idempotent create-order: server-side catalog price & revision check, exact
-- decimal milliquantity, locked invoice sequence, committed result. No receipts.
create function laundry_private.pos_g4_create_order(
 p_device_token text,p_login_token text,p_request_id uuid,
 p_guest_name text,p_member_number text,p_items jsonb,p_perfume text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor record; v_outlet uuid; v_staff uuid; v_member uuid; v_guest uuid;
 v_customer_name text; v_items jsonb; v_item record; v_service record;
 v_i integer:=0; v_qty bigint; v_unit text; v_line bigint; v_subtotal bigint:=0;
 v_revision bigint:=1; v_sequence bigint; v_invoice text; v_order uuid;
 v_payload jsonb; v_hash bytea; v_old record; v_result jsonb;
 v_now timestamptz:=clock_timestamp();
begin
 select a.staff_id,a.outlet_id into v_actor
   from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_create',true) a;
 v_staff:=v_actor.staff_id; v_outlet:=v_actor.outlet_id;
 if p_request_id is null then raise exception 'POS_REQUEST_ID_REQUIRED' using errcode='22023'; end if;
 if p_items is null or pg_catalog.jsonb_typeof(p_items)<>'array'
    or pg_catalog.jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'POS_ITEMS_INVALID' using errcode='22023'; end if;
 if p_perfume is not null and (length(p_perfume)>80 or p_perfume ~ '[[:cntrl:]]') then
    raise exception 'POS_PERFUME_INVALID' using errcode='22023'; end if;
 if p_notes is not null and (length(p_notes)>500 or p_notes ~ '[[:cntrl:]]') then
    raise exception 'POS_NOTES_INVALID' using errcode='22023'; end if;
 -- Digest the normalized request before catalog lookup: an exact retry can
 -- return its previously committed result even if catalog prices later change.
 v_payload:=pg_catalog.jsonb_build_object(
   'guest_name',case when p_member_number is null or btrim(p_member_number)='' then btrim(coalesce(p_guest_name,'')) else null end,
   'member_number',nullif(btrim(coalesce(p_member_number,'')),''),
   'items',p_items,'perfume',p_perfume,'notes',p_notes);
 v_hash:=extensions.digest(v_payload::text,'sha256');
 select c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_staff_id is distinct from v_staff or v_old.payload_digest<>v_hash or
      not (v_old.result ? 'invoice_no') then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;

 if p_member_number is not null and btrim(p_member_number)<>'' then
   if p_member_number !~ '^[1-9][0-9]{0,11}$' then
     raise exception 'POS_MEMBER_INVALID' using errcode='22023'; end if;
   -- Selecting a member also requires the explicitly granted lookup capability.
   perform 1 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'member_lookup',false);
   select m.id,m.display_name into v_member,v_customer_name from public.laundry_members m
    where m.member_number=p_member_number::bigint and m.is_active;
   if not found then raise exception 'POS_MEMBER_NOT_FOUND' using errcode='22023';end if;
   if p_guest_name is not null and btrim(p_guest_name)<>'' then
      raise exception 'POS_CUSTOMER_AMBIGUOUS' using errcode='22023';end if;
 else
   v_customer_name:=btrim(coalesce(p_guest_name,''));
   if length(v_customer_name) not between 2 and 120 or v_customer_name ~ '[[:cntrl:]]' then
     raise exception 'POS_GUEST_NAME_INVALID' using errcode='22023';end if;
 end if;

 -- Validate item structure/values first; reject catalog conflicts before
 -- inserting any journal rows or allocating an invoice.
 v_items:='[]'::jsonb;
 for v_item in select x.value as item from pg_catalog.jsonb_array_elements(p_items) x loop
   v_i:=v_i+1;
   if pg_catalog.jsonb_typeof(v_item.item)<>'object'
      or (select count(*) from pg_catalog.jsonb_object_keys(v_item.item))<>3
      or not (v_item.item ? 'service_id' and v_item.item ? 'quantity' and v_item.item ? 'revision')
      or pg_catalog.jsonb_typeof(v_item.item->'service_id')<>'string'
      or pg_catalog.jsonb_typeof(v_item.item->'quantity')<>'string'
      or pg_catalog.jsonb_typeof(v_item.item->'revision')<>'number'
   then raise exception 'POS_ITEM_FIELDS_INVALID' using errcode='22023'; end if;
   if (v_item.item->>'service_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or (v_item.item->>'quantity') !~ '^(0|[1-9][0-9]{0,6})(\.[0-9]{1,3})?$'
     or (v_item.item->>'revision') !~ '^[1-9][0-9]{0,11}$'
   then raise exception 'POS_ITEM_FORMAT_INVALID' using errcode='22023'; end if;
   select s.id,s.name,s.unit,s.price_idr,s.revision,s.duration,s.is_visible
     into v_service from public.laundry_services s
     where s.id=(v_item.item->>'service_id')::uuid for share;
   if not found or not v_service.is_visible or v_service.revision<>(v_item.item->>'revision')::bigint
   then raise exception 'POS_CATALOG_CHANGED' using errcode='22023';end if;
   v_unit:=case v_service.unit when 'M' then 'm' when 'meter' then 'm'
      when 'satuan' then 'pcs' else v_service.unit end;
   if v_unit not in ('kg','m','pcs') then raise exception 'POS_UNIT_UNSUPPORTED' using errcode='22023';end if;
   if v_unit='pcs' and (v_item.item->>'quantity') like '%.%' then
     raise exception 'POS_PCS_INTEGER_REQUIRED' using errcode='22023';end if;
   v_qty:=((split_part(v_item.item->>'quantity','.',1)::bigint)*1000
         +(rpad(split_part(v_item.item->>'quantity','.',2),3,'0'))::bigint);
   if v_qty<1 or v_qty>1000000000 then raise exception 'POS_QUANTITY_LIMIT' using errcode='22023';end if;
   v_line:=(v_service.price_idr*v_qty+500)/1000;
   v_subtotal:=v_subtotal+v_line;
   if v_subtotal>1000000000 or v_line>1000000000 then
     raise exception 'POS_TOTAL_LIMIT' using errcode='22023';end if;
   v_revision:=greatest(v_revision,v_service.revision);
   v_items:=v_items||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
       'service_id',v_service.id,'service_name',v_service.name,'unit',v_unit,
       'price_idr',v_service.price_idr,'quantity_milli',v_qty,
       'line_total_idr',v_line,'revision',v_service.revision));
 end loop;

 -- The unique request primary key ensures replay after the first commit;
 -- the single outlet lock below serializes concurrent invoice allocation.

 -- Serialize on single outlet row for invoice allocation and prevent a
 -- concurrent toggle of write_enabled between auth and transaction creation.
 perform 1 from public.laundry_pos_outlets o where o.id=v_outlet and o.write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_staff_id is distinct from v_staff or v_old.payload_digest<>v_hash then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 if v_member is null then
   insert into public.laundry_pos_guest_customers(outlet_id,display_name,created_staff_id)
    values(v_outlet,v_customer_name,v_staff) returning id into v_guest;
 end if;
 insert into public.laundry_pos_invoice_counters(outlet_id,last_sequence)
   values(v_outlet,0) on conflict (outlet_id) do nothing;
 update public.laundry_pos_invoice_counters set last_sequence=last_sequence+1
   where outlet_id=v_outlet returning last_sequence into v_sequence;
 v_invoice:='MJL-'||lpad(v_sequence::text,6,'0');
 insert into public.laundry_pos_orders(
   outlet_id,sequence_number,invoice_no,member_id,guest_id,customer_name,
   lifecycle_status,work_status,refund_status,service_subtotal_idr,discount_idr,fees_idr,total_idr,
   catalog_revision,perfume,notes,created_staff_id,confirmed_at)
 values(v_outlet,v_sequence,v_invoice,v_member,v_guest,v_customer_name,
   'CONFIRMED','QUEUED','NONE',v_subtotal,0,0,v_subtotal,
   v_revision,p_perfume,p_notes,v_staff,v_now) returning id into v_order;
 for v_item in select value as item from pg_catalog.jsonb_array_elements(v_items) loop
   v_i:=v_i+1;
   insert into public.laundry_pos_order_items(
     order_id,service_id,line_number,service_name,unit,quantity_milli,price_idr,line_total_idr)
   values(v_order,(v_item.item->>'service_id')::uuid,
          (select count(*)+1 from public.laundry_pos_order_items where order_id=v_order),
          v_item.item->>'service_name',v_item.item->>'unit',
          (v_item.item->>'quantity_milli')::bigint,(v_item.item->>'price_idr')::bigint,
          (v_item.item->>'line_total_idr')::bigint);
 end loop;
 v_result:=pg_catalog.jsonb_build_object('order_id',v_order,'invoice_no',v_invoice,
   'total_idr',v_subtotal::text,'customer_name',v_customer_name,'work_status','QUEUED');
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_staff_id,operation,target_id,payload_digest,result)
   values(p_request_id,v_outlet,v_staff,'CREATE_ORDER',v_order,v_hash,v_result);
 insert into public.laundry_pos_order_events(order_id,command_id,actor_staff_id,kind,data)
   values(v_order,p_request_id,v_staff,'ORDER_CREATED',pg_catalog.jsonb_build_object(
    'invoice_no',v_invoice,'total_idr',v_subtotal::text,'member',v_member is not null));
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_g4_create_order(text,text,uuid,text,text,jsonb,text,text)
 from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_create_order(text,text,uuid,text,text,jsonb,text,text)
 to anon,authenticated;
create function public.laundry_pos_g4_create_order(
 p_device_token text,p_login_token text,p_request_id uuid,
 p_guest_name text,p_member_number text,p_items jsonb,p_perfume text default null,p_notes text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g4_create_order(p_device_token,p_login_token,p_request_id,p_guest_name,p_member_number,p_items,p_perfume,p_notes);
$$;
revoke all on function public.laundry_pos_g4_create_order(text,text,uuid,text,text,jsonb,text,text)
 from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_create_order(text,text,uuid,text,text,jsonb,text,text) to anon,authenticated;

-- Read/list limited to the single outlet and delegated order_view permission.
create function laundry_private.pos_g4_order_list(p_device_token text,p_login_token text)
returns table(id uuid,invoice_no text,customer_name text,total_idr bigint,work_status text,created_at timestamptz)
language plpgsql security definer set search_path='' stable as $$
declare v_staff uuid; v_outlet uuid;
begin
 select a.staff_id,a.outlet_id into v_staff,v_outlet
 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false) a;
 return query select o.id,o.invoice_no,o.customer_name,o.total_idr,o.work_status,o.created_at
   from public.laundry_pos_orders o where o.outlet_id=v_outlet and o.lifecycle_status='CONFIRMED'
   order by o.created_at desc,o.id desc limit 40;
end;
$$;
revoke all on function laundry_private.pos_g4_order_list(text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_order_list(text,text) to anon,authenticated;
create function public.laundry_pos_g4_order_list(p_device_token text,p_login_token text)
returns table(id uuid,invoice_no text,customer_name text,total_idr bigint,work_status text,created_at timestamptz)
language sql security invoker set search_path='' stable as $$
 select * from laundry_private.pos_g4_order_list(p_device_token,p_login_token); $$;
revoke all on function public.laundry_pos_g4_order_list(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_order_list(text,text) to anon,authenticated;

-- Work-only transition with idempotent command: does not receive cash or award points.
create function laundry_private.pos_g4_work_status(p_device_token text,p_login_token text,
 p_request_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; o record; v_hash bytea; v_old record; v_result jsonb;
begin
 select z.staff_id,z.outlet_id into a
   from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_work',true) z;
 if p_request_id is null or p_order_id is null or p_new_status not in ('READY','COLLECTED') then
   raise exception 'POS_WORK_REQUEST_INVALID' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('order',p_order_id,'to',p_new_status)::text,'sha256');
 select c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_staff_id is distinct from a.staff_id or v_old.payload_digest<>v_hash then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets where id=a.outlet_id and write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 -- Two concurrent same-ID requests serialize through the one outlet lock.
 -- The second request rechecks the committed result before looking at new status.
 select c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_staff_id is distinct from a.staff_id or v_old.payload_digest<>v_hash or
      not (v_old.result ? 'work_status') then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 select * into o from public.laundry_pos_orders
   where id=p_order_id and outlet_id=a.outlet_id and lifecycle_status='CONFIRMED' for update;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='22023';end if;
 if not ((o.work_status='QUEUED' and p_new_status='READY') or
         (o.work_status='READY' and p_new_status='COLLECTED')) then
   raise exception 'POS_WORK_TRANSITION_INVALID' using errcode='22023';end if;
 update public.laundry_pos_orders set work_status=p_new_status,version=version+1 where id=p_order_id;
 v_result:=pg_catalog.jsonb_build_object('order_id',p_order_id,'work_status',p_new_status);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_staff_id,operation,target_id,payload_digest,result)
 values(p_request_id,a.outlet_id,a.staff_id,'SET_WORK',p_order_id,v_hash,v_result);
 insert into public.laundry_pos_order_events(order_id,command_id,actor_staff_id,kind,data)
 values(p_order_id,p_request_id,a.staff_id,'WORK_STATUS_CHANGED',pg_catalog.jsonb_build_object('from',o.work_status,'to',p_new_status));
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_g4_work_status(text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_work_status(text,text,uuid,uuid,text) to anon,authenticated;
create function public.laundry_pos_g4_work_status(p_device_token text,p_login_token text,
 p_request_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g4_work_status(p_device_token,p_login_token,p_request_id,p_order_id,p_new_status); $$;
revoke all on function public.laundry_pos_g4_work_status(text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_work_status(text,text,uuid,uuid,text) to anon,authenticated;

-- No admin/anon table grants, payment or point functions. Check the write flag at
-- the database even when a client or server action attempts a bypass.

-- Detail view is projected through a deliberately narrow DTO, no table access.
create function laundry_private.pos_g4_order_detail(
 p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare a record; v_order record; v_lines jsonb;
begin
 select z.staff_id,z.outlet_id into a
 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false) z;
 select o.id,o.invoice_no,o.customer_name,o.total_idr,o.work_status,
    o.lifecycle_status,o.created_at,o.perfume,o.notes,o.created_staff_id
 into v_order from public.laundry_pos_orders o
 where o.id=p_order_id and o.outlet_id=a.outlet_id;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='22023'; end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'service_name',i.service_name,'unit',i.unit,'quantity_milli',i.quantity_milli,
     'price_idr',i.price_idr,'line_total_idr',i.line_total_idr) order by i.line_number), '[]'::jsonb)
 into v_lines from public.laundry_pos_order_items i where i.order_id=p_order_id;
 return pg_catalog.jsonb_build_object('id',v_order.id,'invoice_no',v_order.invoice_no,
    'customer_name',v_order.customer_name,'total_idr',v_order.total_idr::text,
    'work_status',v_order.work_status,'lifecycle_status',v_order.lifecycle_status,
    'created_at',v_order.created_at,'perfume',v_order.perfume,'notes',v_order.notes,
    'created_staff_id',v_order.created_staff_id,'items',v_lines);
end;
$$;
revoke all on function laundry_private.pos_g4_order_detail(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_order_detail(text,text,uuid) to anon,authenticated;
create function public.laundry_pos_g4_order_detail(p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_g4_order_detail(p_device_token,p_login_token,p_order_id);
$$;
revoke all on function public.laundry_pos_g4_order_detail(text,text,uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_order_detail(text,text,uuid) to anon,authenticated;