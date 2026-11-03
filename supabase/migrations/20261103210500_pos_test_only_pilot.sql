-- TEST-ONLY PILOT: not G8 GO. Backend enforces a dummy guest boundary.
-- This preserves genuine customer/member records while letting staff test the POS before 2027.
alter table public.laundry_pos_outlets
 add column pilot_test_only boolean not null default false;
alter table public.laundry_pos_orders
 add column is_test_order boolean not null default false;
alter table public.laundry_pos_orders
 add constraint pos_test_order_guest_only check (
  not is_test_order or (
   member_id is null and guest_id is not null
   and customer_name ~* '^UJI - .{2,}$'
  )
 );

create function laundry_private.pos_test_only_order_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_pilot boolean;
begin
 if tg_op='INSERT' then
  select o.pilot_test_only into v_pilot
    from public.laundry_pos_outlets o where o.id=new.outlet_id;
  if coalesce(v_pilot,false) then
   if new.member_id is not null or new.guest_id is null
      or new.customer_name !~* '^UJI - .{2,}$' then
    raise exception 'POS_PILOT_GUEST_ONLY' using errcode='22023';
   end if;
   new.is_test_order:=true;
  elsif new.is_test_order then
   raise exception 'POS_TEST_MARKER_FORBIDDEN' using errcode='22023';
  end if;
 else
  if new.is_test_order is distinct from old.is_test_order
     or (old.is_test_order and (
      new.member_id is not null
      or new.guest_id is distinct from old.guest_id
      or new.customer_name is distinct from old.customer_name
     )) then
   raise exception 'POS_TEST_ORDER_IMMUTABLE' using errcode='22023';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function laundry_private.pos_test_only_order_guard() from public,anon,authenticated;
create trigger pos_test_only_order_guard
 before insert or update on public.laundry_pos_orders
 for each row execute function laundry_private.pos_test_only_order_guard();

create function laundry_private.pos_test_point_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.laundry_pos_orders o
    where o.id=new.order_id and o.is_test_order) then
  raise exception 'POS_TEST_POINTS_FORBIDDEN' using errcode='22023';
 end if;
 return new;
end;
$$;
revoke all on function laundry_private.pos_test_point_guard() from public,anon,authenticated;
create trigger pos_test_point_guard
 before insert on public.laundry_pos_point_links
 for each row execute function laundry_private.pos_test_point_guard();

-- Preserve the existing owner/cashier auth checks and only expose the pilot switch.
create or replace function public.laundry_pos_package_catalog(
 p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
 if p_device_token is null and p_login_token is null then
  perform laundry_private.pos_owner_required();
 else
  perform 1 from laundry_private.pos_g4_cashier_authorize(
   p_device_token,p_login_token,'order_view',false);
 end if;
 return jsonb_build_object(
 'enabled',(select package_workflow_enabled from public.laundry_pos_outlets where singleton_key=1),
 'pilot_test_only',(select pilot_test_only from public.laundry_pos_outlets where singleton_key=1),
 'delivery_options',coalesce((select jsonb_agg(jsonb_build_object(
   'code',d.code,'name',d.name,'amount_idr',d.amount_idr,'revision',d.revision)
   order by d.position) from laundry_private.pos_delivery_options d where d.active),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object(
   'id',s.id,'category',s.category,'package_name',s.package_name,
   'name',s.name,'price_idr',s.price_idr,'unit',s.unit,'duration',s.duration,
   'revision',s.revision,'duration_package_code',s.duration_package_code)
   order by s.position,s.id)
   from public.laundry_services s
   join public.laundry_pos_duration_packages p on p.code=s.duration_package_code
   join public.laundry_pos_service_families f on f.id=s.family_id
   where s.is_visible and p.active and f.active),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.laundry_pos_package_catalog(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_package_catalog(text,text) to anon,authenticated;
