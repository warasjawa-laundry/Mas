-- No historical ETA or contact backfill. Hand-over has no unpaid override.
alter table public.laundry_pos_orders
 add column package_code_snapshot text,add column package_name_snapshot text,
 add column package_revision_snapshot bigint,add column package_minutes_snapshot integer,
 add column ready_at timestamptz,add column collected_at timestamptz;
alter table public.laundry_pos_orders drop constraint laundry_pos_orders_work_status_check;
alter table public.laundry_pos_orders add constraint laundry_pos_orders_work_status_check check(work_status in ('QUEUED','PROCESSING','READY','COLLECTED'));
create function laundry_private.pos_handover_guard() returns trigger language plpgsql set search_path='' as $$
declare paid bigint;
begin
 if new.work_status='COLLECTED' and old.work_status is distinct from 'COLLECTED' then
  select coalesce(sum(case entry_type when 'RECEIPT' then amount_idr else -amount_idr end),0) into paid from public.laundry_pos_payments where order_id=new.id;
  if old.work_status<>'READY' or new.lifecycle_status<>'CONFIRMED' or new.total_idr<=0 or new.refund_status<>'NONE' or paid<>new.total_idr
  then raise exception 'POS_HANDOVER_REQUIRES_SETTLED_PAYMENT' using errcode='22023';end if;
  new.collected_at:=clock_timestamp();
 end if;
 if new.work_status='READY' and old.work_status is distinct from 'READY' then new.ready_at:=clock_timestamp();end if;
 return new;
end; $$;
revoke all on function laundry_private.pos_handover_guard() from public,anon,authenticated;
create trigger pos_handover_guard before update of work_status on public.laundry_pos_orders for each row execute function laundry_private.pos_handover_guard();
create or replace function laundry_private.pos_create_order_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid,
 p_guest_name text,p_member_number text,p_items jsonb,p_perfume text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_outlet uuid:=p_outlet; v_staff uuid:=p_staff; v_member uuid; v_guest uuid;
 v_customer_name text; v_items jsonb; v_item record; v_service record;
 v_i integer:=0; v_qty bigint; v_unit text; v_line bigint; v_subtotal bigint:=0;
 v_revision bigint:=1; v_sequence bigint; v_invoice text; v_order uuid;
 v_payload jsonb; v_hash bytea; v_old record; v_result jsonb;
 v_package text; v_package_row record; v_now timestamptz; v_minutes integer; v_max_minutes integer:=0; v_all_known boolean:=true;
begin
 if (p_owner is null) = (p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null then raise exception 'POS_REQUEST_ID_REQUIRED' using errcode='22023'; end if;
 -- Digest the normalized request before catalog lookup: an exact retry can
 -- return its previously committed result even if catalog prices later change.
 v_payload:=pg_catalog.jsonb_build_object(
   'guest_name',case when p_member_number is null or btrim(p_member_number)='' then btrim(coalesce(p_guest_name,'')) else null end,
   'member_number',nullif(btrim(coalesce(p_member_number,'')),''),
   'items',p_items,'perfume',p_perfume,'notes',p_notes);
 v_hash:=extensions.digest(v_payload::text,'sha256');
 select c.actor_id,c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from v_staff or v_old.payload_digest<>v_hash or
      not (v_old.result ? 'invoice_no') then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;

 -- The unique request primary key ensures replay after the first commit;
 -- the single outlet lock below serializes concurrent invoice allocation.

 -- Serialize on single outlet row for invoice allocation and prevent a
 -- concurrent toggle of write_enabled between auth and transaction creation.
 perform 1 from public.laundry_pos_outlets o where o.id=v_outlet and o.active and o.write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_id,c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from v_staff or v_old.payload_digest<>v_hash or not (v_old.result ? 'invoice_no') then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 if p_items is null or pg_catalog.jsonb_typeof(p_items)<>'array'
    or pg_catalog.jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'POS_ITEMS_INVALID' using errcode='22023'; end if;
 if p_perfume is not null and (length(p_perfume)>80 or p_perfume ~ '[[:cntrl:]]') then
    raise exception 'POS_PERFUME_INVALID' using errcode='22023'; end if;
 if p_notes is not null and (length(p_notes)>500 or p_notes ~ '[[:cntrl:]]') then
    raise exception 'POS_NOTES_INVALID' using errcode='22023'; end if;
 if p_member_number is not null and btrim(p_member_number)<>'' then
   if p_member_number !~ '^[1-9][0-9]{0,11}$' then
     raise exception 'POS_MEMBER_INVALID' using errcode='22023'; end if;
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
   select s.id,s.name,s.unit,s.price_idr,s.revision,s.duration,s.duration_minutes,s.category,s.package_name,s.is_visible
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
   v_minutes:=laundry_private.pos_duration_minutes(v_service.duration,v_service.duration_minutes);
   if v_minutes is null then v_all_known:=false;else v_max_minutes:=greatest(v_max_minutes,v_minutes);end if;
   v_items:=v_items||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
       'service_id',v_service.id,'service_name',v_service.name,'unit',v_unit,
       'price_idr',v_service.price_idr,'quantity_milli',v_qty,
       'line_total_idr',v_line,'revision',v_service.revision,
       'category',v_service.category,'package',v_service.package_name,
       'duration_label',v_service.duration,'duration_minutes',v_minutes));
 end loop;

 if (select package_workflow_enabled from public.laundry_pos_outlets where id=v_outlet) then
  if exists(select 1 from jsonb_array_elements(p_items) x left join public.laundry_services s on s.id=(x->>'service_id')::uuid
   left join public.laundry_pos_duration_packages p on p.code=s.duration_package_code
   left join public.laundry_pos_service_families f on f.id=s.family_id
   where s.id is null or s.duration_package_code is null or not p.active or not f.active)
   or (select count(distinct s.duration_package_code) from public.laundry_services s join jsonb_array_elements(p_items) x on s.id=(x->>'service_id')::uuid)<>1
  then raise exception 'POS_SINGLE_PACKAGE_REQUIRED' using errcode='22023';end if;
  select s.duration_package_code into v_package from public.laundry_services s where s.id=(p_items->0->>'service_id')::uuid;
  select * into strict v_package_row from public.laundry_pos_duration_packages where code=v_package;
 end if;
 v_now:=clock_timestamp();
 if v_member is null then
   insert into public.laundry_pos_guest_customers(outlet_id,display_name,created_by,created_staff_id)
    values(v_outlet,v_customer_name,p_owner,v_staff) returning id into v_guest;
 end if;
 insert into public.laundry_pos_invoice_counters(outlet_id,last_sequence)
   values(v_outlet,0) on conflict (outlet_id) do nothing;
 update public.laundry_pos_invoice_counters set last_sequence=last_sequence+1
   where outlet_id=v_outlet returning last_sequence into v_sequence;
 v_invoice:='MJL-'||lpad(v_sequence::text,greatest(6,length(v_sequence::text)),'0');
 insert into public.laundry_pos_orders(
   outlet_id,sequence_number,invoice_no,member_id,guest_id,customer_name,
   lifecycle_status,work_status,refund_status,service_subtotal_idr,discount_idr,fees_idr,total_idr,
   catalog_revision,perfume,notes,created_by,created_staff_id,confirmed_at,created_at,due_at,eta_status)
 values(v_outlet,v_sequence,v_invoice,v_member,v_guest,v_customer_name,
   'CONFIRMED','QUEUED','NONE',v_subtotal,0,0,v_subtotal,
   v_revision,p_perfume,p_notes,p_owner,v_staff,v_now,v_now,
   case when v_all_known then v_now+v_max_minutes*interval '1 minute' end,
   case when v_all_known then 'SCHEDULED' else 'PENDING' end) returning id into v_order;
 for v_item in select value as item from pg_catalog.jsonb_array_elements(v_items) loop
   v_i:=v_i+1;
   insert into public.laundry_pos_order_items(
     order_id,service_id,line_number,service_name,unit,quantity_milli,price_idr,line_total_idr,
     category_snapshot,package_snapshot,catalog_revision,duration_label,duration_minutes,due_at)
   values(v_order,(v_item.item->>'service_id')::uuid,
          (select count(*)+1 from public.laundry_pos_order_items where order_id=v_order),
          v_item.item->>'service_name',v_item.item->>'unit',
          (v_item.item->>'quantity_milli')::bigint,(v_item.item->>'price_idr')::bigint,
          (v_item.item->>'line_total_idr')::bigint,
          v_item.item->>'category',v_item.item->>'package',(v_item.item->>'revision')::bigint,
          v_item.item->>'duration_label',(v_item.item->>'duration_minutes')::integer,
          v_now+(v_item.item->>'duration_minutes')::integer*interval '1 minute');
 end loop;
 if v_package is not null then
  update public.laundry_pos_orders set package_code_snapshot=v_package,package_name_snapshot=v_package_row.name,
   package_revision_snapshot=v_package_row.revision,package_minutes_snapshot=v_package_row.duration_minutes where id=v_order;
 end if;
 v_result:=pg_catalog.jsonb_build_object('order_id',v_order,'invoice_no',v_invoice,
   'total_idr',v_subtotal::text,'customer_name',v_customer_name,'work_status','QUEUED',
   'due_at',case when v_all_known then v_now+v_max_minutes*interval '1 minute' end,
   'eta_status',case when v_all_known then 'SCHEDULED' else 'PENDING' end);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,operation,target_id,payload_digest,result)
   values(p_request_id,v_outlet,p_owner,v_staff,'CREATE_ORDER',v_order,v_hash,v_result);
 insert into public.laundry_pos_order_events(order_id,command_id,actor_id,actor_staff_id,kind,data)
   values(v_order,p_request_id,p_owner,v_staff,'ORDER_CREATED',pg_catalog.jsonb_build_object(
    'invoice_no',v_invoice,'total_idr',v_subtotal::text,'member',v_member is not null));
 return v_result;
end;
$$;

revoke all on function laundry_private.pos_create_order_core(uuid,uuid,uuid,uuid,text,text,jsonb,text,text) from public,anon,authenticated;


create or replace function laundry_private.pos_work_status_core(p_owner uuid,p_staff uuid,p_outlet uuid,
 p_request_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o record; v_hash bytea; v_old record; v_result jsonb;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null or p_order_id is null or p_new_status not in ('PROCESSING','READY','COLLECTED') then
   raise exception 'POS_WORK_REQUEST_INVALID' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('order',p_order_id,'to',p_new_status)::text,'sha256');
 select c.actor_id,c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.payload_digest<>v_hash then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets where id=p_outlet and active and write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 -- Two concurrent same-ID requests serialize through the one outlet lock.
 -- The second request rechecks the committed result before looking at new status.
 select c.actor_id,c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.payload_digest<>v_hash or
      not (v_old.result ? 'work_status') then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 select * into o from public.laundry_pos_orders
   where id=p_order_id and outlet_id=p_outlet and lifecycle_status='CONFIRMED' for update;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='22023';end if;
 if not ((o.work_status='QUEUED' and p_new_status in ('PROCESSING','READY')) or (o.work_status='PROCESSING' and p_new_status='READY') or
         (o.work_status='READY' and p_new_status='COLLECTED')) then
   raise exception 'POS_WORK_TRANSITION_INVALID' using errcode='22023';end if;
 update public.laundry_pos_orders set work_status=p_new_status,version=version+1 where id=p_order_id;
 v_result:=pg_catalog.jsonb_build_object('order_id',p_order_id,'work_status',p_new_status);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,operation,target_id,payload_digest,result)
 values(p_request_id,p_outlet,p_owner,p_staff,'SET_WORK',p_order_id,v_hash,v_result);
 insert into public.laundry_pos_order_events(order_id,command_id,actor_id,actor_staff_id,kind,data)
 values(p_order_id,p_request_id,p_owner,p_staff,'WORK_STATUS_CHANGED',pg_catalog.jsonb_build_object('from',o.work_status,'to',p_new_status));
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_work_status_core(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;

