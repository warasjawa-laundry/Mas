-- Read-only pilot estimates. No member identifiers, balances or ledger writes.
create function laundry_private.pos_simulation_points(p_total bigint,p_year integer,p_state text,p_persisted boolean)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare rule_v record; tier jsonb; points_v integer:=0; available boolean;
begin
 select tiers,revision into rule_v from public.laundry_point_rules where program_year=p_year;
 available:=found;
 if available then
  for tier in select value from jsonb_array_elements(rule_v.tiers) order by (value->>'minimum')::bigint loop
   if p_total >= (tier->>'minimum')::bigint then points_v:=(tier->>'points')::integer;end if;
  end loop;
 end if;
 return jsonb_build_object('booked',false,'total_idr',p_total::text,'state',p_state,
  'program_year',p_year,'rule_revision',case when available then rule_v.revision else null end,
  'rule_available',available,'points',case when available then points_v else null end,
  'persisted_order',p_persisted,'calculated_at',statement_timestamp());
end; $$;
revoke all on function laundry_private.pos_simulation_points(bigint,integer,text,boolean) from public,anon,authenticated;

create function public.laundry_pos_point_simulation(
 p_order_id uuid default null,p_items jsonb default null,p_delivery_code text default null,p_delivery_revision bigint default null,
 p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare outlet uuid; order_v record; service_v record; delivery_v record; item jsonb;
 total_v bigint:=0; qty bigint; line_v bigint; unit_v text; state_v text:='ESTIMATE';
 year_v integer:=extract(year from timezone('Asia/Jakarta',statement_timestamp()))::integer;
 paid bigint:=0; refunded bigint:=0; settled_at timestamptz; package_mode boolean; package_code text;
begin
 if p_device_token is null and p_login_token is null then
  perform laundry_private.pos_owner_required();outlet:=laundry_private.pos_owner_outlet();
 else
  if p_order_id is null then
   select z.outlet_id into outlet from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_create',false) z;
  else
   begin
    select z.outlet_id into outlet from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false) z;
   exception when insufficient_privilege then
    -- Receipt-only staff already have permission to read the same invoice amounts.
    select z.outlet_id into outlet from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'whatsapp_draft',false) z;
   end;
  end if;
 end if;
 if p_order_id is not null then
  select * into order_v from public.laundry_pos_orders where id=p_order_id and outlet_id=outlet;
  if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='42501';end if;
  if not order_v.is_test_order then return null;end if;
  total_v:=order_v.total_idr;
  select coalesce(sum(amount_idr) filter(where entry_type='RECEIPT'),0),
   coalesce(sum(amount_idr) filter(where entry_type='REFUND'),0),max(confirmed_at) filter(where entry_type='RECEIPT')
   into paid,refunded,settled_at from public.laundry_pos_payments where order_id=p_order_id;
  state_v:=case when refunded>0 or order_v.refund_status<>'NONE' then 'REFUNDED'
   when order_v.lifecycle_status<>'CONFIRMED' then 'CANCELLED' when total_v=0 then 'ZERO_TOTAL'
   when paid=total_v then 'PAID' when paid>0 then 'PARTIAL' else 'UNPAID' end;
  if state_v in ('PAID','REFUNDED') and paid=total_v and settled_at is not null then
   year_v:=extract(year from timezone('Asia/Jakarta',settled_at))::integer;
  end if;
 else
  select package_workflow_enabled into package_mode from public.laundry_pos_outlets where id=outlet and pilot_test_only;
  if not found then return null;end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30
  then raise exception 'POS_ITEMS_INVALID' using errcode='22023';end if;
  select * into delivery_v from laundry_private.pos_delivery_options
   where code=p_delivery_code and active and revision=p_delivery_revision;
  if not found then raise exception 'POS_DELIVERY_PRICE_CHANGED' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>3
    or jsonb_typeof(item->'service_id') is distinct from 'string'
    or jsonb_typeof(item->'quantity') is distinct from 'string'
    or jsonb_typeof(item->'revision') is distinct from 'number'
    or item->>'service_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or item->>'quantity' !~ '^(0|[1-9][0-9]{0,6})(\.[0-9]{1,3})?$'
    or item->>'revision' !~ '^[1-9][0-9]{0,11}$'
   then raise exception 'POS_ITEM_FORMAT_INVALID' using errcode='22023';end if;
   select * into service_v from public.laundry_services where id=(item->>'service_id')::uuid and is_visible;
   if not found or service_v.revision<>(item->>'revision')::bigint
   then raise exception 'POS_CATALOG_CHANGED' using errcode='22023';end if;
   if package_mode then
    if not exists(select 1 from public.laundry_pos_duration_packages p join public.laundry_pos_service_families f
     on f.id=service_v.family_id where p.code=service_v.duration_package_code and p.active and f.active)
     or (package_code is not null and package_code<>service_v.duration_package_code)
    then raise exception 'POS_SINGLE_PACKAGE_REQUIRED' using errcode='22023';end if;
    package_code:=service_v.duration_package_code;
   end if;
   unit_v:=case service_v.unit when 'M' then 'm' when 'meter' then 'm' when 'satuan' then 'pcs' else service_v.unit end;
   if unit_v not in ('kg','m','pcs') or (unit_v='pcs' and item->>'quantity' like '%.%')
   then raise exception 'POS_QUANTITY_INVALID' using errcode='22023';end if;
   qty:=split_part(item->>'quantity','.',1)::bigint*1000+rpad(split_part(item->>'quantity','.',2),3,'0')::bigint;
   if qty<1 or qty>1000000000 then raise exception 'POS_QUANTITY_LIMIT' using errcode='22023';end if;
   line_v:=(service_v.price_idr*qty+500)/1000;total_v:=total_v+line_v;
   if line_v>1000000000 or total_v>1000000000 then raise exception 'POS_TOTAL_LIMIT' using errcode='22023';end if;
  end loop;
  total_v:=total_v+delivery_v.amount_idr;
  if total_v>1000000000 then raise exception 'POS_TOTAL_LIMIT' using errcode='22023';end if;
 end if;
 return laundry_private.pos_simulation_points(total_v,year_v,state_v,p_order_id is not null)
  ||jsonb_build_object('paid_idr',paid::text,'refunded_idr',refunded::text);
end; $$;
revoke all on function public.laundry_pos_point_simulation(uuid,jsonb,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_point_simulation(uuid,jsonb,text,bigint,text,text) to anon,authenticated;
