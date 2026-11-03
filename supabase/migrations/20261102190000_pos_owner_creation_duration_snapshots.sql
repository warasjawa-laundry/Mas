-- Additive only: no historical ETA backfill, writes remain behind the outlet switch.
alter table public.laundry_services add column duration_minutes integer
 check (duration_minutes between 1 and 525600);
alter table public.laundry_pos_orders add column eta_status text not null default 'PENDING'
 check (eta_status in ('PENDING','SCHEDULED'));
alter table public.laundry_pos_order_items
 add column category_snapshot text,
 add column package_snapshot text,
 add column catalog_revision bigint check (catalog_revision>0),
 add column duration_label text,
 add column duration_minutes integer check (duration_minutes between 1 and 525600),
 add column due_at timestamptz;

-- Exact labels describe elapsed minutes, not business-day opening hours.
create function laundry_private.pos_duration_minutes(p_label text,p_minutes integer)
returns integer language plpgsql immutable set search_path='' as $$
declare parts text[]; minutes bigint;
begin
 if p_minutes is not null then return p_minutes;end if;
 parts:=pg_catalog.regexp_match(lower(btrim(p_label)),'^([1-9][0-9]{0,5}) (menit|jam|hari)$');
 if parts is null then return null;end if;
 minutes:=parts[1]::bigint * case parts[2] when 'hari' then 1440 when 'jam' then 60 else 1 end;
 if minutes between 1 and 525600 then return minutes::integer;end if;
 return null;
end; $$;
revoke all on function laundry_private.pos_duration_minutes(text,integer) from public,anon,authenticated;

create function laundry_private.pos_create_order_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid,
 p_guest_name text,p_member_number text,p_items jsonb,p_perfume text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_outlet uuid:=p_outlet; v_staff uuid:=p_staff; v_member uuid; v_guest uuid;
 v_customer_name text; v_items jsonb; v_item record; v_service record;
 v_i integer:=0; v_qty bigint; v_unit text; v_line bigint; v_subtotal bigint:=0;
 v_revision bigint:=1; v_sequence bigint; v_invoice text; v_order uuid;
 v_payload jsonb; v_hash bytea; v_old record; v_result jsonb;
 v_now timestamptz; v_minutes integer; v_max_minutes integer:=0; v_all_known boolean:=true;
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

create or replace function laundry_private.pos_g4_create_order(
 p_device_token text,p_login_token text,p_request_id uuid,
 p_guest_name text,p_member_number text,p_items jsonb,p_perfume text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor record;
begin
 select a.staff_id,a.outlet_id into actor from
 laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_create',false) a;
 if nullif(btrim(p_member_number),'') is not null then
  perform 1 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'member_lookup',false);
 end if;
 return laundry_private.pos_create_order_core(null,actor.staff_id,actor.outlet_id,p_request_id,
  p_guest_name,p_member_number,p_items,p_perfume,p_notes);
end; $$;
revoke all on function laundry_private.pos_g4_create_order(text,text,uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_create_order(text,text,uuid,text,text,jsonb,text,text) to anon,authenticated;

create function laundry_private.pos_owner_create_order(p_request_id uuid,p_guest_name text,p_member_number text,
 p_items jsonb,p_perfume text default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 select o.id into outlet_id from public.laundry_pos_outlets o where o.singleton_key=1 and o.active;
 if outlet_id is null then raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 return laundry_private.pos_create_order_core(owner_id,null,outlet_id,p_request_id,
  p_guest_name,p_member_number,p_items,p_perfume,p_notes);
end; $$;
revoke all on function laundry_private.pos_owner_create_order(uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_create_order(uuid,text,text,jsonb,text,text) to authenticated;
create function public.laundry_pos_owner_create_order(p_request_id uuid,p_guest_name text,p_member_number text,
 p_items jsonb,p_perfume text default null,p_notes text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_create_order(p_request_id,p_guest_name,p_member_number,p_items,p_perfume,p_notes);
$$;
revoke all on function public.laundry_pos_owner_create_order(uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_create_order(uuid,text,text,jsonb,text,text) to authenticated;

create function laundry_private.pos_owner_capabilities()
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare result jsonb;
begin
 perform laundry_private.pos_owner_required();
 select pg_catalog.jsonb_build_object('write_enabled',o.active and o.write_enabled,'duration_support',true)
 into result from public.laundry_pos_outlets o where o.singleton_key=1;
 return coalesce(result,'{"write_enabled":false,"duration_support":true}'::jsonb);
end; $$;
revoke all on function laundry_private.pos_owner_capabilities() from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_capabilities() to authenticated;
create function public.laundry_pos_owner_capabilities()
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_owner_capabilities(); $$;
revoke all on function public.laundry_pos_owner_capabilities() from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_capabilities() to authenticated;

-- Minutes participate in the same optimistic revision check as catalog prices.
create or replace function laundry_private.save_service(p_id uuid,p_expected_revision bigint,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_revision bigint; category_v text; package_v text; name_v text; unit_v text; duration_v text; minutes_v integer; has_minutes boolean; price_v bigint; position_v integer;
begin
 if actor is null or not exists(select 1 from public.laundry_owner_accounts where auth_user_id=actor and is_active) then raise exception 'owner_required' using errcode='42501';end if;
 if p_id is null or p_expected_revision is null or p_expected_revision<0 or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'catalog_invalid';end if;
 if jsonb_typeof(p_input->'category') is distinct from 'string' or jsonb_typeof(p_input->'package_name') is distinct from 'string' or jsonb_typeof(p_input->'name') is distinct from 'string' or jsonb_typeof(p_input->'unit') is distinct from 'string' or jsonb_typeof(p_input->'duration') is distinct from 'string' or jsonb_typeof(p_input->'is_visible') is distinct from 'boolean' or jsonb_typeof(p_input->'price_idr') is distinct from 'number' or jsonb_typeof(p_input->'position') is distinct from 'number' then raise exception 'catalog_invalid';end if;
 category_v:=btrim(p_input->>'category');package_v:=btrim(p_input->>'package_name');name_v:=btrim(p_input->>'name');unit_v:=btrim(p_input->>'unit');duration_v:=btrim(p_input->>'duration');
 if length(category_v) not between 1 and 80 or length(package_v)>80 or length(name_v) not between 1 and 100 or length(unit_v) not between 1 and 24 or length(duration_v)>80 or (category_v||package_v||name_v||unit_v||duration_v) ~ '[[:cntrl:]]' or (p_input->>'price_idr') !~ '^(0|[1-9][0-9]{0,9})$' or (p_input->>'position') !~ '^[0-9]{1,4}$' then raise exception 'catalog_invalid';end if;
 has_minutes:=p_input ? 'duration_minutes';
 if has_minutes and p_input->'duration_minutes'<>'null'::jsonb then
  if jsonb_typeof(p_input->'duration_minutes')<>'number' or (p_input->>'duration_minutes') !~ '^[1-9][0-9]{0,5}$'
   or (p_input->>'duration_minutes')::bigint>525600 then raise exception 'catalog_invalid';end if;
  minutes_v:=(p_input->>'duration_minutes')::integer;
 end if;
 price_v:=(p_input->>'price_idr')::bigint;position_v:=(p_input->>'position')::integer;
 if price_v>1000000000 then raise exception 'catalog_invalid';end if;
 -- Serializes the catalogue cap and revisions, including simultaneous additions.
 perform 1 from public.laundry_catalog_version where singleton for update;
 select revision into current_revision from public.laundry_services where id=p_id;
 if not found then
  if p_expected_revision<>0 then raise exception 'catalog_conflict';end if;
  if (select count(*) from public.laundry_services)>=200 then raise exception 'catalog_limit';end if;
  insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration,duration_minutes,position,is_visible,updated_by)
  values(p_id,category_v,package_v,name_v,price_v,unit_v,duration_v,minutes_v,position_v,(p_input->>'is_visible')::boolean,actor);
 else
  if current_revision<>p_expected_revision then raise exception 'catalog_conflict';end if;
  update public.laundry_services set category=category_v,package_name=package_v,name=name_v,price_idr=price_v,unit=unit_v,duration_minutes=case when has_minutes then minutes_v when duration=duration_v then duration_minutes else null end,duration=duration_v,position=position_v,is_visible=(p_input->>'is_visible')::boolean,revision=revision+1,updated_at=now(),updated_by=actor where id=p_id;
 end if;
end;
$$;
revoke all on function laundry_private.save_service(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function laundry_private.save_service(uuid,bigint,jsonb) to authenticated;
create or replace function public.laundry_save_service(p_id uuid,p_expected_revision bigint,p_input jsonb) returns void language sql security invoker set search_path='' as $$select laundry_private.save_service(p_id,p_expected_revision,p_input);$$;
revoke all on function public.laundry_save_service(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.laundry_save_service(uuid,bigint,jsonb) to authenticated;

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
 where o.id=p_order_id and o.lifecycle_status='CONFIRMED';
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
    o.lifecycle_status,o.created_at,o.perfume,o.notes,o.created_by,o.created_staff_id,o.due_at,o.eta_status
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
