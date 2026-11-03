begin;
do $test$
declare owner_id uuid:=gen_random_uuid(); service_id uuid:=gen_random_uuid(); order_id uuid;
 normal_id uuid; cashier uuid; device uuid; login_name text; delivery_rev bigint; r jsonb;
 device_token text:=repeat('P',43); login_token text:=repeat('Q',43); items jsonb;
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true,
  package_workflow_enabled=false,pilot_test_only=true where singleton_key=1;
 insert into public.laundry_services(id,category,name,price_idr,unit,duration)
  values(service_id,'QA','QA receipt boundary',4000,'kg','6 jam');
 select revision into delivery_rev from laundry_private.pos_delivery_options where code='NEAR';
 items:=jsonb_build_array(jsonb_build_object('service_id',service_id,'revision',1,'quantity','1'));
 r:=public.laundry_pos_owner_create_order_with_delivery(gen_random_uuid(),'uji - QA document',null,items,'Sakura',null,'NEAR',delivery_rev);
 order_id:=(r->>'order_id')::uuid;
 if r->>'invoice_no' !~ '^NOTA-1[0-9]{5,}$' then raise exception 'invoice namespace not applied';end if;
 if (public.laundry_pos_owner_order_detail(order_id)->>'is_test_order')::boolean is distinct from true
 then raise exception 'owner detail lost authoritative test marker';end if;
 if public.laundry_pos_owner_order_detail(order_id)->'delivery'->>'amount_idr' is distinct from '3000'
 then raise exception 'owner detail lost delivery snapshot';end if;
 perform public.laundry_pos_owner_open_shift(gen_random_uuid());
 perform public.laundry_pos_owner_payment(gen_random_uuid(),order_id,'7000','CASH',1);
 r:=public.laundry_pos_whatsapp_receipt(order_id,'NEW');
 if (r->>'is_test_order')::boolean is distinct from true or r->>'status'<>'PAID'
  or r->'contact' is distinct from 'null'::jsonb or r->'member' is distinct from 'null'::jsonb
 then raise exception 'test receipt missing simulation boundary';end if;
 perform public.laundry_pos_verify_order_contact(order_id,gen_random_uuid(),'+6280000000000','QA test recipient',true);
 if public.laundry_pos_whatsapp_receipt(order_id,'NEW')->'contact'->>'phone' is distinct from '+6280000000000'
 then raise exception 'confirmed test contact unavailable';end if;
 cashier:=public.laundry_pos_owner_save_cashier(null,'QA document cashier','{"order_view":true,"whatsapp_draft":true}',true);
 select username into login_name from public.laundry_pos_staff where staff_id=cashier;
 if login_name !~ '^MAS-2[0-9]{3}$' then raise exception 'cashier namespace not applied';end if;
 device:=public.laundry_pos_owner_pair_cashier(cashier,device_token);
 if not public.laundry_pos_cashier_login(device_token,login_name,login_token) then raise exception 'QA login failed';end if;
 perform set_config('request.jwt.claim.sub','',true);
 if (public.laundry_pos_g4_order_detail(device_token,login_token,order_id)->>'is_test_order')::boolean is distinct from true
  or (public.laundry_pos_whatsapp_receipt(order_id,'NEW',device_token,login_token)->>'is_test_order')::boolean is distinct from true
 then raise exception 'cashier detail/receipt lost test marker';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.laundry_pos_outlets set pilot_test_only=false where singleton_key=1;
 normal_id:=(public.laundry_pos_owner_create_order_with_delivery(gen_random_uuid(),'UJI - Normal nonpilot',null,items,'Sakura',null,'NEAR',delivery_rev)->>'order_id')::uuid;
 perform public.laundry_pos_verify_order_contact(normal_id,gen_random_uuid(),'+6280000000000','QA address',true);
 r:=public.laundry_pos_whatsapp_receipt(normal_id,'NEW');
 if (r->>'is_test_order')::boolean is distinct from false or r->'contact'->>'phone'<>'+6280000000000'
 then raise exception 'normal receipt changed or name prefix used instead of DB marker';end if;
 if has_function_privilege('anon','laundry_private.pos_create_order_with_delivery_core(uuid,uuid,uuid,uuid,text,text,jsonb,text,text,text,bigint)','execute')
  or has_function_privilege('authenticated','laundry_private.pos_create_order_with_delivery_core(uuid,uuid,uuid,uuid,text,text,jsonb,text,text,text,bigint)','execute')
 then raise exception 'private test contact guard exposed';end if;
end $test$;
rollback;
