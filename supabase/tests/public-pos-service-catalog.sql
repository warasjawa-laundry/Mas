begin;
set local statement_timeout='15s';
do $test$
declare family_v uuid:=gen_random_uuid(); service_v uuid:=gen_random_uuid(); rows_v jsonb;
begin
 update public.laundry_pos_duration_packages set active=true,duration_minutes=case code when 'REGULAR' then 4320 when 'EXPRESS' then 1440 else 360 end;
 insert into public.laundry_pos_service_families(id,name,category,unit,position,active)
 values(family_v,'QA public price','QA public catalogue','kg',9998,true);
 insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration,duration_minutes,position,is_visible,family_id,duration_package_code,package_available)
 values(service_v,'QA public catalogue','Reguler','QA public price',7500,'kg','4320 menit',4320,9998,true,family_v,'REGULAR',true),
 (gen_random_uuid(),'QA public catalogue','Ekspres','QA public price',0,'kg','1440 menit',1440,9998,true,family_v,'EXPRESS',false);
 execute 'set local role anon';
 select jsonb_agg(to_jsonb(c)) into rows_v from public.laundry_public_service_catalog() c where c.id=service_v;
 if rows_v->0->>'duration_package_code'<>'REGULAR' or rows_v->0->>'duration_minutes'<>'4320' or rows_v->0->>'package_name'<>'Reguler' or rows_v->0->>'price_idr'<>'7500' then raise exception 'public catalogue snapshot wrong: %',rows_v;end if;
 if exists(select 1 from public.laundry_public_service_catalog() where category='QA public catalogue' and price_idr=0) then raise exception 'unavailable tariff exposed';end if;
 begin perform 1 from public.laundry_pos_duration_packages;raise exception 'anonymous package table access allowed';exception when insufficient_privilege then null;end;
 begin perform public.laundry_pos_package_catalog();raise exception 'anonymous operational catalog access allowed';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update public.laundry_pos_duration_packages set duration_minutes=90 where code='REGULAR';
 if (select duration_minutes from public.laundry_public_service_catalog() where id=service_v)<>90 then raise exception 'package edit not reflected';end if;
 update public.laundry_pos_service_families set active=false where id=family_v;
 if exists(select 1 from public.laundry_public_service_catalog() where id=service_v) then raise exception 'inactive family exposed';end if;
 update public.laundry_pos_service_families set active=true where id=family_v;
 update public.laundry_pos_duration_packages set active=false where code='REGULAR';
 if exists(select 1 from public.laundry_public_service_catalog() where id=service_v) then raise exception 'inactive package exposed';end if;
 update public.laundry_pos_duration_packages set active=true where code='REGULAR';
 update public.laundry_services set is_visible=false,duration='90 menit',duration_minutes=90 where id=service_v;
 if exists(select 1 from public.laundry_public_service_catalog() where id=service_v) then raise exception 'hidden service exposed';end if;
 if (select provolatile from pg_proc where oid='public.laundry_public_service_catalog()'::regprocedure)<>'s' then raise exception 'catalog function is not stable';end if;
end;
$test$;
rollback;
