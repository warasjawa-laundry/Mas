begin;
do $test$
declare owner_id uuid:=gen_random_uuid(); family uuid:=gen_random_uuid(); service_r uuid; service_e uuid;
 order_id uuid; legacy_id uuid:=gen_random_uuid(); adopted uuid:=gen_random_uuid(); items jsonb; r jsonb; req uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.laundry_pos_save_package('REGULAR',1,'Reguler',4320,true);
 perform public.laundry_pos_save_package('EXPRESS',1,'Ekspres',1440,true);
 perform public.laundry_pos_save_family(family,0,'{"name":"QA grouped service","category":"QA","unit":"kg","position":1,"active":true}',
 '[{"code":"REGULAR","price_idr":"4000","active":true},{"code":"EXPRESS","price_idr":"7000","active":true},{"code":"FLASH","price_idr":"0","active":false}]');
 if (select count(*) from public.laundry_pos_service_families where id=family)<>1 then raise exception 'family duplicated';end if;
 insert into public.laundry_services(id,category,name,unit,price_idr,duration) values(legacy_id,'QA','QA legacy service','kg',1234,'6 jam');
 perform public.laundry_pos_save_family(adopted,0,'{"name":"QA adopted service","category":"QA","unit":"kg","position":2,"active":true}',
 jsonb_build_array(jsonb_build_object('code','REGULAR','price_idr','1234','active',true,'existing_id',legacy_id,'existing_revision',1),
 jsonb_build_object('code','EXPRESS','price_idr','0','active',false),jsonb_build_object('code','FLASH','price_idr','0','active',false)));
 if not exists(select 1 from public.laundry_services where id=legacy_id and family_id=adopted and duration_package_code='REGULAR')
 or (select count(*) from public.laundry_services where family_id=adopted)<>3 then raise exception 'legacy adoption duplicated source';end if;
 perform public.laundry_pos_enable_package_workflow();
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true where singleton_key=1;
 select id into service_r from public.laundry_services where family_id=family and duration_package_code='REGULAR';
 select id into service_e from public.laundry_services where family_id=family and duration_package_code='EXPRESS';
 begin
  perform public.laundry_pos_owner_create_order(gen_random_uuid(),'QA mixed invalid',null,
   jsonb_build_array(jsonb_build_object('service_id',service_r,'revision',1,'quantity','1'),jsonb_build_object('service_id',service_e,'revision',1,'quantity','1')));
  raise exception 'mixed packages accepted';
 exception when invalid_parameter_value then if sqlerrm<>'POS_SINGLE_PACKAGE_REQUIRED' then raise;end if;end;
 items:=jsonb_build_array(jsonb_build_object('service_id',service_r,'revision',1,'quantity','4.9'));
 r:=public.laundry_pos_owner_create_order(req,'QA package guest',null,items);order_id:=(r->>'order_id')::uuid;
 if r->>'total_idr'<>'19600' or not exists(select 1 from public.laundry_pos_orders where id=order_id and
  package_minutes_snapshot=4320 and package_revision_snapshot=2 and due_at=created_at+interval '72 hours') then raise exception 'package snapshot wrong';end if;
 perform public.laundry_pos_save_package('REGULAR',2,'Reguler',60,true);
 if not exists(select 1 from public.laundry_pos_orders where id=order_id and package_minutes_snapshot=4320 and due_at=created_at+interval '72 hours')
 or public.laundry_pos_owner_create_order(req,'QA package guest',null,items)<>r then raise exception 'history or replay changed';end if;
 perform public.laundry_pos_owner_work_status(gen_random_uuid(),order_id,'PROCESSING');
 perform public.laundry_pos_owner_work_status(gen_random_uuid(),order_id,'READY');
 begin
  perform public.laundry_pos_owner_work_status(gen_random_uuid(),order_id,'COLLECTED');raise exception 'unpaid handover accepted';
 exception when invalid_parameter_value then if sqlerrm<>'POS_HANDOVER_REQUIRES_SETTLED_PAYMENT' then raise;end if;end;
 perform public.laundry_pos_owner_open_shift(gen_random_uuid());
 perform public.laundry_pos_owner_payment(gen_random_uuid(),order_id,'10000','CASH',3);
 begin
  perform public.laundry_pos_owner_work_status(gen_random_uuid(),order_id,'COLLECTED');raise exception 'DP handover accepted';
 exception when invalid_parameter_value then if sqlerrm<>'POS_HANDOVER_REQUIRES_SETTLED_PAYMENT' then raise;end if;end;
 perform public.laundry_pos_owner_payment(gen_random_uuid(),order_id,'9600','CASH',4);
 req:=gen_random_uuid();r:=public.laundry_pos_owner_work_status(req,order_id,'COLLECTED');
 if public.laundry_pos_owner_work_status(req,order_id,'COLLECTED')<>r or
 not exists(select 1 from public.laundry_pos_orders where id=order_id and collected_at is not null and ready_at is not null)
 then raise exception 'handover history/retry failed';end if;
 if has_function_privilege('anon','public.laundry_pos_save_package(text,bigint,text,integer,boolean)','execute')
 or has_table_privilege('authenticated','public.laundry_pos_service_families','insert') then raise exception 'catalog privilege leak';end if;
end; $test$;
rollback;
