begin;
set local statement_timeout='30s';
do $test$
declare owner_v uuid:=gen_random_uuid();family_v uuid:=gen_random_uuid();service_v uuid;request_v uuid:=gen_random_uuid();order_v uuid;
 result_v jsonb;again_v jsonb;wa_v jsonb;audit_v jsonb;items_v jsonb;rev_v bigint;rows_v bigint;
 staff_v uuid;name_v text;device_v text:=repeat('n',43);login_v text:=repeat('o',43);
begin
 insert into auth.users(id,aud,role) values(owner_v,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_v,true);
 perform set_config('request.jwt.claim.sub',owner_v::text,true);
 update public.laundry_pos_outlets set active=true,write_enabled=true,finance_enabled=true,pilot_test_only=true,package_workflow_enabled=true;
 perform public.laundry_pos_save_package('REGULAR',(select revision from public.laundry_pos_duration_packages where code='REGULAR'),'Reguler',4320,true);
 perform public.laundry_pos_save_family(family_v,0,'{"name":"QA V31 contacts","category":"QA V31","unit":"kg","position":1,"active":true}',
  '[{"code":"REGULAR","price_idr":"6000","active":true},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
 select id into service_v from public.laundry_services where family_id=family_v and duration_package_code='REGULAR';
 select revision into rev_v from laundry_private.pos_delivery_options where code='NONE';
 items_v:=jsonb_build_array(jsonb_build_object('service_id',service_v,'quantity','0.75','revision',1));
 result_v:=public.laundry_pos_v31_create_order(request_v,'UJI - V31 contacts',null,items_v,null,null,'NONE',rev_v,'+628111111111','Alamat penguji');
 again_v:=public.laundry_pos_v31_create_order(request_v,'UJI - V31 contacts',null,items_v,null,null,'NONE',rev_v,'+628111111111','Alamat penguji');
 order_v:=(result_v->>'order_id')::uuid;
 if result_v<>again_v or (select count(*) from laundry_private.pos_order_contact_drafts where order_id=order_v)<>1 then raise exception 'contact retry duplicated order/draft';end if;
 begin
  perform public.laundry_pos_v31_create_order(request_v,'UJI - V31 contacts',null,items_v,null,null,'NONE',rev_v,'+628222222222','Alamat penguji');
  raise exception 'contact conflict accepted';
 exception when raise_exception then if sqlerrm<>'POS_REQUEST_CONFLICT' then raise;end if;end;
 wa_v:=public.laundry_pos_v31_whatsapp_receipt(order_v,'NEW');audit_v:=public.laundry_pos_order_audit(order_v);
 if wa_v->'contact_draft'->>'phone'<>'+628111111111' or wa_v->'contact_draft'->>'verified_at' is not null or wa_v->>'contact' is not null
  or audit_v->'contact_draft'<>wa_v->'contact_draft' then raise exception 'draft contact became verified or unavailable';end if;
 if public.laundry_pos_v31_print_receipt(order_v) ? 'contact_draft' then raise exception 'print exposed unused contact draft';end if;
 perform public.laundry_pos_verify_order_contact(order_v,gen_random_uuid(),'+628111111111','Alamat penguji',true);
 if public.laundry_pos_v31_whatsapp_receipt(order_v,'NEW')->'contact'->>'verified_at' is null then raise exception 'explicit verification did not persist';end if;
 if exists(select 1 from public.laundry_pos_payments where order_id=order_v) or exists(select 1 from public.laundry_pos_point_links where order_id=order_v) then raise exception 'contact generated payment/points';end if;
 select count(*) into rows_v from public.laundry_pos_orders;
 begin
  perform public.laundry_pos_v31_create_order(gen_random_uuid(),'UJI - Invalid contact',null,items_v,null,null,'NONE',rev_v,'invalid','');
  raise exception 'invalid contact accepted';
 exception when invalid_parameter_value then null;end;
 if rows_v<>(select count(*) from public.laundry_pos_orders) then raise exception 'invalid contact left an order';end if;
 staff_v:=public.laundry_pos_owner_save_cashier(null,'QA V31 Contact Kasir','{"order_create":true,"order_view":true}',true);
 select username into name_v from public.laundry_pos_staff where staff_id=staff_v;
 perform set_config('request.jwt.claim.sub','',true);
 if not public.laundry_pos_cashier_direct_id_login(name_v,device_v,login_v) then raise exception 'cashier login failed';end if;
 result_v:=public.laundry_pos_v31_create_order(gen_random_uuid(),'UJI - Cashier contact',null,items_v,null,null,'NONE',rev_v,null,'Alamat kasir',device_v,login_v);
 order_v:=(result_v->>'order_id')::uuid;
 if public.laundry_pos_order_audit(order_v,device_v,login_v)->'contact_draft'->>'address'<>'Alamat kasir' then raise exception 'cashier contact missing';end if;
 begin perform public.laundry_pos_v31_create_order(gen_random_uuid(),'UJI - Unauthorized',null,items_v,null,null,'NONE',rev_v,null,'');raise exception 'anonymous creation accepted';exception when insufficient_privilege then null;end;
end;$test$;
rollback;
