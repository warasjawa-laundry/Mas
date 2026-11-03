-- Operator-only maintenance. Invoke for explicitly approved dummy note UUIDs,
-- never as an automatic sweep. The caller must own the underlying tables.
create table laundry_private.pos_retired_test_orders (
 order_id uuid primary key,
 retired_at timestamptz not null default clock_timestamp(),
 retired_by text not null default current_user,
 reason text not null,
 snapshot jsonb not null,
 snapshot_hash text generated always as (md5(snapshot::text)) stored
);
alter table laundry_private.pos_retired_test_orders enable row level security;
revoke all on laundry_private.pos_retired_test_orders from public,anon,authenticated;
create trigger pos_retired_tests_immutable before update or delete on laundry_private.pos_retired_test_orders
 for each row execute function laundry_private.pos_reject_journal_changes();

create function laundry_private.pos_retire_test_order(p_order_id uuid) returns jsonb
language plpgsql set search_path='' as $$
declare o public.laundry_pos_orders; data jsonb;
begin
 perform 1 from public.laundry_pos_outlets where singleton_key=1 for update;
 if exists(select 1 from laundry_private.pos_retired_test_orders where order_id=p_order_id) then
  return jsonb_build_object('retired',true,'order_id',p_order_id);end if;
 select * into o from public.laundry_pos_orders where id=p_order_id for update;
 if not found or not o.is_test_order or o.member_id is not null then
  raise exception 'POS_RETIRE_REQUIRES_TEST_ORDER' using errcode='22023';end if;
 if exists(select 1 from public.laundry_pos_point_links where order_id=p_order_id) then
  raise exception 'POS_RETIRE_POINT_RECONCILIATION_REQUIRED' using errcode='22023';end if;
 if exists(select 1 from public.laundry_pos_payments p join public.laundry_pos_cash_shifts s on s.id=p.shift_id
   where p.order_id=p_order_id and s.closed_at is not null) then
  raise exception 'POS_RETIRE_CLOSED_SHIFT_RECONCILIATION_REQUIRED' using errcode='22023';end if;
 -- Acquire write locks before suspending immutable triggers inside this transaction.
 lock table public.laundry_pos_cash_ledger,public.laundry_pos_payments,public.laundry_pos_order_events,laundry_private.pos_order_contacts in access exclusive mode;
 data:=jsonb_build_object('order',to_jsonb(o),
  'items',coalesce((select jsonb_agg(to_jsonb(x)) from public.laundry_pos_order_items x where order_id=p_order_id),'[]'::jsonb),
  'adjustments',coalesce((select jsonb_agg(to_jsonb(x)) from public.laundry_pos_order_adjustments x where order_id=p_order_id),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(to_jsonb(x)) from public.laundry_pos_payments x where order_id=p_order_id),'[]'::jsonb),
  'cash',coalesce((select jsonb_agg(to_jsonb(x)) from public.laundry_pos_cash_ledger x where payment_id in (select id from public.laundry_pos_payments where order_id=p_order_id)),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(x)) from public.laundry_pos_order_events x where order_id=p_order_id),'[]'::jsonb),
  'contacts',coalesce((select jsonb_agg(to_jsonb(x)) from laundry_private.pos_order_contacts x where order_id=p_order_id),'[]'::jsonb),
  'commands',coalesce((select jsonb_agg(to_jsonb(x)) from public.laundry_pos_commands x where target_id=p_order_id),'[]'::jsonb),
  'shifts',coalesce((select jsonb_agg(to_jsonb(x)) from public.laundry_pos_cash_shifts x where id in (select shift_id from public.laundry_pos_payments where order_id=p_order_id)),'[]'::jsonb));
 insert into laundry_private.pos_retired_test_orders(order_id,reason,snapshot)
  values(p_order_id,'Owner requested removal of old pilot notes for numeric namespace reset',data);
 alter table public.laundry_pos_cash_ledger disable trigger pos_ledger_immutable;
 alter table public.laundry_pos_payments disable trigger pos_payments_immutable;
 alter table public.laundry_pos_order_events disable trigger pos_order_events_immutable;
 alter table laundry_private.pos_order_contacts disable trigger pos_contacts_immutable;
 delete from public.laundry_pos_cash_ledger where payment_id in (select id from public.laundry_pos_payments where order_id=p_order_id);
 delete from public.laundry_pos_payments where order_id=p_order_id and entry_type='REFUND';
 delete from public.laundry_pos_payments where order_id=p_order_id;
 delete from public.laundry_pos_order_events where order_id=p_order_id;
 delete from laundry_private.pos_order_contacts where order_id=p_order_id;
 delete from public.laundry_pos_order_adjustments where order_id=p_order_id;
 delete from public.laundry_pos_order_items where order_id=p_order_id;
 delete from public.laundry_pos_orders where id=p_order_id;
 alter table public.laundry_pos_cash_ledger enable trigger pos_ledger_immutable;
 alter table public.laundry_pos_payments enable trigger pos_payments_immutable;
 alter table public.laundry_pos_order_events enable trigger pos_order_events_immutable;
 alter table laundry_private.pos_order_contacts enable trigger pos_contacts_immutable;
 -- Commands remain immutable tombstones so old UUIDs can never create new money/orders.
 return jsonb_build_object('retired',true,'order_id',p_order_id);
end; $$;
revoke all on function laundry_private.pos_retire_test_order(uuid) from public,anon,authenticated;

-- Owner requested namespaces: member display 0, invoice 1, cashier 2.
-- Preserve UUIDs and old cashier labels; existing physical card tokens are untouched.
alter table public.laundry_pos_staff add column previous_username text;
do $renumber$
declare s record; n integer;
begin
 lock table public.laundry_pos_outlets in exclusive mode;
 lock table public.laundry_pos_staff in exclusive mode;
 alter table public.laundry_pos_staff disable trigger pos_cashier_username_immutable;
 for s in select staff_id,username from public.laundry_pos_staff where username !~ '^MAS-2[0-9]{3}$' order by created_at,staff_id loop
  select min(i) into n from generate_series(2001,2999) i where not exists(select 1 from public.laundry_pos_staff where username='MAS-'||i::text);
  if n is null then raise exception 'cashier_username_limit';end if;
  update public.laundry_pos_staff set previous_username=username,username='MAS-'||n::text where staff_id=s.staff_id;
  update public.laundry_pos_cashier_devices set revoked_at=clock_timestamp() where staff_id=s.staff_id and revoked_at is null;
 end loop;
 update public.laundry_pos_outlets set last_cashier_number=coalesce((select max(substring(username from 5)::integer-2000) from public.laundry_pos_staff),0) where singleton_key=1;
 alter table public.laundry_pos_staff enable trigger pos_cashier_username_immutable;
end $renumber$;

create or replace function laundry_private.pos_owner_save_cashier(
 p_staff_id uuid,p_display_name text,p_permissions jsonb,p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_outlet uuid; v_id uuid; v_name text:=btrim(coalesce(p_display_name,''));
        v_before jsonb; v_number integer;
begin
 v_owner:=laundry_private.pos_owner_required();
 if p_active is null or length(v_name) not between 2 and 100
   or v_name ~ '[[:cntrl:]]' or not laundry_private.pos_valid_cashier_permissions(p_permissions)
 then raise exception 'invalid_cashier' using errcode='22023'; end if;
 select id into strict v_outlet from public.laundry_pos_outlets where singleton_key=1;
 if p_staff_id is null then
   -- Row lock on the fixed outlet serializes concurrent owner requests.
   -- Rolling back a failed create also rolls back the counter increment.
   update public.laundry_pos_outlets set last_cashier_number=last_cashier_number+1
    where id=v_outlet and last_cashier_number<999
    returning last_cashier_number into v_number;
   if v_number is null then raise exception 'cashier_username_limit' using errcode='22023';end if;
   insert into public.laundry_pos_staff(display_name,active,username)
     values(v_name,p_active,'MAS-2'||lpad(v_number::text,3,'0')) returning staff_id into v_id;
   insert into public.laundry_pos_staff_outlets(staff_id,outlet_id,role,enabled,permissions)
     values(v_id,v_outlet,'cashier',p_active,p_permissions);
   v_before:='{}'::jsonb;
 else
   v_id:=p_staff_id;
   select jsonb_build_object('name',st.display_name,'active',st.active,'username',st.username,'permissions',so.permissions)
     into v_before from public.laundry_pos_staff st
     join public.laundry_pos_staff_outlets so on so.staff_id=st.staff_id
     where st.staff_id=v_id and so.outlet_id=v_outlet for update of st,so;
   if not found then raise exception 'cashier_not_found' using errcode='22023'; end if;
   update public.laundry_pos_staff set display_name=v_name,active=p_active where staff_id=v_id;
   update public.laundry_pos_staff_outlets set enabled=p_active,permissions=p_permissions
     where staff_id=v_id and outlet_id=v_outlet;
   if not p_active then
     update public.laundry_pos_cashier_devices set revoked_at=clock_timestamp()
     where staff_id=v_id and revoked_at is null;
   end if;
 end if;
 insert into public.laundry_pos_cashier_audit(staff_id,owner_id,action,changes)
 values(v_id,v_owner,case when p_staff_id is null then 'CREATE'
                         when not p_active then 'DISABLE' else 'UPDATE' end,
        jsonb_build_object('before',v_before,'after',jsonb_build_object(
          'name',v_name,'active',p_active,'permissions',p_permissions,
          'username',(select username from public.laundry_pos_staff where staff_id=v_id))));
 return v_id;
end;
$$;

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
   if exists(select 1 from laundry_private.pos_retired_test_orders where order_id=(v_old.result->>'order_id')::uuid) then raise exception 'POS_ORDER_RETIRED' using errcode='22023';end if;
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
   if exists(select 1 from laundry_private.pos_retired_test_orders where order_id=(v_old.result->>'order_id')::uuid) then raise exception 'POS_ORDER_RETIRED' using errcode='22023';end if;
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
 v_invoice:='NOTA-1'||lpad(v_sequence::text,greatest(5,length(v_sequence::text)),'0');
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

create or replace function laundry_private.pos_create_order_with_delivery_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid,
 p_guest_name text,p_member_number text,p_items jsonb,p_perfume text,p_notes text,p_delivery_code text,p_delivery_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_outlet uuid:=p_outlet; v_staff uuid:=p_staff; v_member uuid; v_guest uuid;
 v_customer_name text; v_items jsonb; v_item record; v_service record;
 v_i integer:=0; v_qty bigint; v_unit text; v_line bigint; v_subtotal bigint:=0;
 v_revision bigint:=1; v_sequence bigint; v_invoice text; v_order uuid;
 v_delivery record; v_total bigint:=0;
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
   'items',p_items,'perfume',p_perfume,'notes',p_notes,
   'delivery_code',p_delivery_code,'delivery_revision',p_delivery_revision);
 v_hash:=extensions.digest(v_payload::text,'sha256');
 select c.actor_id,c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if exists(select 1 from laundry_private.pos_retired_test_orders where order_id=(v_old.result->>'order_id')::uuid) then raise exception 'POS_ORDER_RETIRED' using errcode='22023';end if;
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
   if exists(select 1 from laundry_private.pos_retired_test_orders where order_id=(v_old.result->>'order_id')::uuid) then raise exception 'POS_ORDER_RETIRED' using errcode='22023';end if;
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from v_staff or v_old.payload_digest<>v_hash or not (v_old.result ? 'invoice_no') then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 if p_delivery_code not in ('NONE','FREE','NEAR','FAR') or p_delivery_revision is null or p_delivery_revision<1 then
  raise exception 'POS_DELIVERY_INVALID' using errcode='22023';end if;
 select * into v_delivery from laundry_private.pos_delivery_options d
  where d.code=p_delivery_code and d.active and d.revision=p_delivery_revision for share;
 if not found then raise exception 'POS_DELIVERY_PRICE_CHANGED' using errcode='22023';end if;
 if p_perfume is not null and p_perfume not in ('Akasia','Junjung Buih','Lavender','Ocean','Sakura') then
  raise exception 'POS_PERFUME_INVALID' using errcode='22023';end if;
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
 v_total:=v_subtotal+v_delivery.amount_idr;
 if v_total>1000000000 then raise exception 'POS_TOTAL_LIMIT' using errcode='22023';end if;

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
 v_invoice:='NOTA-1'||lpad(v_sequence::text,greatest(5,length(v_sequence::text)),'0');
 insert into public.laundry_pos_orders(
   outlet_id,sequence_number,invoice_no,member_id,guest_id,customer_name,
   lifecycle_status,work_status,refund_status,service_subtotal_idr,discount_idr,fees_idr,total_idr,
   catalog_revision,perfume,notes,created_by,created_staff_id,confirmed_at,created_at,due_at,eta_status,
   delivery_code_snapshot,delivery_name_snapshot,delivery_fee_idr,delivery_revision_snapshot)
 values(v_outlet,v_sequence,v_invoice,v_member,v_guest,v_customer_name,
   'CONFIRMED','QUEUED','NONE',v_subtotal,0,v_delivery.amount_idr,v_total,
   v_revision,p_perfume,p_notes,p_owner,v_staff,v_now,v_now,
   case when v_all_known then v_now+v_max_minutes*interval '1 minute' end,
   case when v_all_known then 'SCHEDULED' else 'PENDING' end,
   v_delivery.code,v_delivery.name,v_delivery.amount_idr,v_delivery.revision) returning id into v_order;
 if v_delivery.code<>'NONE' then
  insert into public.laundry_pos_order_adjustments(order_id,kind,amount_idr,reason,authorized_by)
  values(v_order,'DELIVERY',v_delivery.amount_idr,'Antar-jemput: '||v_delivery.name,p_owner);
 end if;
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
   'total_idr',v_total::text,'service_subtotal_idr',v_subtotal::text,
   'delivery_fee_idr',v_delivery.amount_idr::text,'delivery_name',v_delivery.name,
   'customer_name',v_customer_name,'work_status','QUEUED',
   'due_at',case when v_all_known then v_now+v_max_minutes*interval '1 minute' end,
   'eta_status',case when v_all_known then 'SCHEDULED' else 'PENDING' end);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,operation,target_id,payload_digest,result)
   values(p_request_id,v_outlet,p_owner,v_staff,'CREATE_ORDER',v_order,v_hash,v_result);
 insert into public.laundry_pos_order_events(order_id,command_id,actor_id,actor_staff_id,kind,data)
   values(v_order,p_request_id,p_owner,v_staff,'ORDER_CREATED',pg_catalog.jsonb_build_object(
    'invoice_no',v_invoice,'total_idr',v_total::text,'delivery_fee_idr',v_delivery.amount_idr::text,'member',v_member is not null));
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_create_order_with_delivery_core(uuid,uuid,uuid,uuid,text,text,jsonb,text,text,text,bigint) from public,anon,authenticated;


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
 return jsonb_build_object('is_test_order',o.is_test_order,'invoice',o.invoice_no,'customer',o.customer_name,'actor',actor,'contact',contact_v,
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

-- Test contacts use the same owner/cashier authorization, consent and idempotency checks.
-- The immutable test marker and no-member/no-point guards remain active.
drop trigger if exists pos_test_contact_guard on laundry_private.pos_order_contacts;
drop function if exists laundry_private.pos_test_contact_guard();
