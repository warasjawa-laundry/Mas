-- Display metadata only. No data backfill, journal writes, or flag changes.
create function public.laundry_pos_display_context(
 p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare outlet_v uuid; result jsonb;
begin
 if p_device_token is null and p_login_token is null then
  perform laundry_private.pos_owner_required();
  select id into outlet_v from public.laundry_pos_outlets where singleton_key=1;
 else
  select s.outlet_id into outlet_v from laundry_private.pos_cashier_logged_in(p_device_token,p_login_token) s;
  if not found then raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 end if;
 select jsonb_build_object('pilot_test_only',o.pilot_test_only,'write_enabled',o.active and o.write_enabled,
  'finance_enabled',o.active and o.write_enabled and o.finance_enabled) into result
 from public.laundry_pos_outlets o where o.id=outlet_v and o.active;
 if result is null then raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 return result;
end; $$;
revoke all on function public.laundry_pos_display_context(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_display_context(text,text) to anon,authenticated;

create or replace function public.laundry_pos_package_catalog(
 p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
 if p_device_token is null and p_login_token is null then
  perform laundry_private.pos_owner_required();
 else
  if not exists(select 1 from laundry_private.pos_cashier_logged_in(p_device_token,p_login_token) s
    where coalesce((s.permissions->>'order_view')::boolean,false) or coalesce((s.permissions->>'order_create')::boolean,false)) then
   raise exception 'POS_ACCESS_DENIED' using errcode='42501';
  end if;
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
