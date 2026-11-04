-- Public tariff projection only. No customer data, catalogue writes or POS grants.
create function public.laundry_public_service_catalog()
returns table(id uuid,category text,package_name text,name text,price_idr bigint,unit text,
 duration text,duration_minutes integer,duration_package_code text,"position" integer)
language sql stable security definer set search_path='' as $$
 select s.id,s.category,p.name,s.name,s.price_idr,s.unit,s.duration,p.duration_minutes,p.code,
  (p.position*10000+s.position)::integer
 from public.laundry_services s
 join public.laundry_pos_duration_packages p on p.code=s.duration_package_code
 join public.laundry_pos_service_families f on f.id=s.family_id
 where s.is_visible and s.package_available and p.active and f.active
 order by p.position,s.position,s.id;
$$;
revoke all on function public.laundry_public_service_catalog() from public,anon,authenticated;
grant execute on function public.laundry_public_service_catalog() to anon,authenticated;
