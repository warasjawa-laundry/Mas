-- Synthetic fixtures. All changes, version events and test identities roll back.
begin;
do $test$
declare actor uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); service_id uuid:=gen_random_uuid(); before_version bigint; payload jsonb; denied boolean; i integer;
begin
 insert into auth.users(id,aud,role) values(actor,'authenticated','authenticated'),(stranger,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(actor,true);
 select revision into before_version from public.laundry_catalog_version;
 payload:='{"category":"QA shoes","package_name":"Reguler","name":"Synthetic sneakers","price_idr":35000,"unit":"pasang","duration":"2 hari","position":9990,"is_visible":true}'::jsonb;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 perform public.laundry_save_service(service_id,0,payload);
 if (select price_idr from public.laundry_services where id=service_id)<>35000 then raise exception 'owner save failed';end if;
 if (select revision from public.laundry_catalog_version)<>before_version+1 then raise exception 'live version not bumped';end if;
 denied:=false;begin update public.laundry_services set price_idr=1 where id=service_id;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'direct table write allowed';end if;
 -- Category, name, package, price, unit and visibility are editable together.
 payload:=payload||'{"category":"QA carpets","package_name":"","name":"Synthetic carpet","price_idr":20000,"unit":"m²","is_visible":false}'::jsonb;
 perform public.laundry_save_service(service_id,1,payload);
 denied:=false;begin perform public.laundry_save_service(service_id,1,payload||'{"price_idr":1}'::jsonb);exception when raise_exception then denied:=sqlerrm='catalog_conflict';end;
 if not denied or (select price_idr from public.laundry_services where id=service_id)<>20000 then raise exception 'stale overwrite allowed';end if;
 denied:=false;begin perform public.laundry_save_service(service_id,2,payload||'{"price_idr":-1}'::jsonb);exception when raise_exception then denied:=sqlerrm='catalog_invalid';end;
 if not denied then raise exception 'negative price allowed';end if;
 denied:=false;begin perform public.laundry_save_service(service_id,2,payload||'{"is_visible":null}'::jsonb);exception when raise_exception then denied:=sqlerrm='catalog_invalid';end;
 if not denied then raise exception 'null visibility allowed';end if;
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 if exists(select 1 from public.laundry_services) then raise exception 'nonowner reads owner catalogue';end if;
 denied:=false;begin perform public.laundry_save_service(service_id,2,payload);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'nonowner write allowed';end if;
 execute 'set local role anon';
 if exists(select id from public.laundry_services where id=service_id) then raise exception 'hidden service disclosed';end if;
 denied:=false;begin perform updated_by from public.laundry_services;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'actor disclosed';end if;
 denied:=false;begin perform public.laundry_save_service(service_id,2,payload);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'anon RPC write allowed';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 perform public.laundry_save_service(service_id,2,payload||'{"is_visible":true}'::jsonb);
 execute 'set local role anon';
 if not exists(select id from public.laundry_services where id=service_id and category='QA carpets' and name='Synthetic carpet' and unit='m²' and price_idr=20000) then raise exception 'published price/category missing';end if;
 execute 'reset role';
 update public.laundry_owner_accounts set is_active=false where auth_user_id=actor;
 execute 'set local role authenticated';
 denied:=false;begin perform public.laundry_save_service(service_id,3,payload);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'inactive owner write allowed';end if;
 execute 'reset role';
 update public.laundry_owner_accounts set is_active=true where auth_user_id=actor;
 insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration,position,is_visible)
 select gen_random_uuid(),'Synthetic cap','','Fixture',1,'item','',9999,false from generate_series(1,200-(select count(*)::integer from public.laundry_services));
 execute 'set local role authenticated';
 denied:=false;begin perform public.laundry_save_service(gen_random_uuid(),0,payload);exception when raise_exception then denied:=sqlerrm='catalog_limit';end;
 if not denied then raise exception 'catalogue cap not enforced';end if;
 execute 'reset role';
end;
$test$;
rollback;
