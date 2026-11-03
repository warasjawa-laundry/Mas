begin;
do $test$
declare owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); service_id uuid:=gen_random_uuid(); order_id uuid;
 items jsonb; r jsonb; req uuid:=gen_random_uuid(); settings jsonb; cashier uuid; device uuid; another uuid; zero_service uuid:=gen_random_uuid();
 device_token text:=repeat('J',43); login_token text:=repeat('K',43);
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.laundry_members(id,member_number,display_name,created_by) overriding system value values(member_id,987651234,'WA QA Member',owner_id);
 insert into public.laundry_services(id,category,name,unit,price_idr,duration) values(service_id,'QA','WA QA service','kg',19600,'6 jam');
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true where singleton_key=1;
 items:=jsonb_build_array(jsonb_build_object('service_id',service_id,'quantity','1','revision',1));
 order_id:=(public.laundry_pos_owner_create_order(gen_random_uuid(),null,'987651234',items)->>'order_id')::uuid;
 r:=public.laundry_pos_whatsapp_receipt(order_id,'NEW');
 if r->>'status'<>'UNPAID' or r->>'remaining'<>'19600' or r->'member'->>'balance'<>'0' or r->'member'->>'projected'<>'1'
 or r->'contact'<>'null'::jsonb then raise exception 'unpaid receipt wrong %',r;end if;
 begin
  perform public.laundry_pos_verify_order_contact(order_id,req,'+6280000000000','QA Address',false);raise exception 'unverified contact accepted';
 exception when raise_exception then if sqlerrm<>'contact_invalid' then raise;end if;end;
 perform public.laundry_pos_verify_order_contact(order_id,req,'+6280000000000','QA Address',true);
 perform public.laundry_pos_verify_order_contact(order_id,req,'+6280000000000','QA Address',true);
 if (select count(*) from laundry_private.pos_order_contacts where request_id=req)<>1 then raise exception 'contact duplicated';end if;
 perform public.laundry_pos_owner_open_shift(gen_random_uuid());
 perform public.laundry_pos_owner_payment(gen_random_uuid(),order_id,'10000','CASH',1);
 r:=public.laundry_pos_whatsapp_receipt(order_id,'NEW');
 if r->>'status'<>'PARTIAL' or r->>'remaining'<>'9600' or r->'member'->>'balance'<>'0' or r->'member'->>'awarded'<>'0'
 or r->'contact'->>'phone'<>'+6280000000000' then raise exception 'DP receipt wrong';end if;
 perform public.laundry_pos_owner_payment(gen_random_uuid(),order_id,'9600','CASH',2);
 perform public.laundry_pos_owner_work_status(gen_random_uuid(),order_id,'READY');
 r:=public.laundry_pos_whatsapp_receipt(order_id,'READY');
 if r->>'status'<>'PAID' or r->>'remaining'<>'0' or r->'member'->>'balance'<>'1' or r->'member'->>'awarded'<>'1'
 then raise exception 'settled receipt excludes posted points %',r;end if;
 perform public.laundry_pos_owner_work_status(gen_random_uuid(),order_id,'COLLECTED');
 r:=public.laundry_pos_whatsapp_receipt(order_id,'COLLECTED');
 if public.laundry_pos_owner_order_detail(order_id)->>'collected_at' is null or jsonb_array_length(public.laundry_pos_owner_order_detail(order_id)->'events')<3 then raise exception 'invoice timeline missing';end if;
 if r->>'collector' is null then raise exception 'actual collector missing';end if;
 if r->>'collected_at' is null then raise exception 'collection timestamp missing';end if;
 another:=(public.laundry_pos_owner_create_order(gen_random_uuid(),null,'987651234',items)->>'order_id')::uuid;
 perform public.laundry_pos_owner_payment(gen_random_uuid(),another,'19600','CASH',1);
 perform public.laundry_pos_owner_work_status(gen_random_uuid(),another,'READY');
 perform public.laundry_pos_owner_refund_full(gen_random_uuid(),another,'QA refunded before handover',3);
 begin
  perform public.laundry_pos_owner_work_status(gen_random_uuid(),another,'COLLECTED');raise exception 'refunded handover accepted';
 exception when invalid_parameter_value then if sqlerrm<>'POS_HANDOVER_REQUIRES_SETTLED_PAYMENT' then raise;end if;end;
 insert into public.laundry_services(id,category,name,unit,price_idr,duration) values(zero_service,'QA','QA zero','pcs',0,'6 jam');
 another:=(public.laundry_pos_owner_create_order(gen_random_uuid(),'QA zero guest',null,jsonb_build_array(jsonb_build_object('service_id',zero_service,'quantity','1','revision',1)))->>'order_id')::uuid;
 perform public.laundry_pos_owner_work_status(gen_random_uuid(),another,'READY');
 begin
  perform public.laundry_pos_owner_work_status(gen_random_uuid(),another,'COLLECTED');raise exception 'zero-total handover accepted';
 exception when invalid_parameter_value then if sqlerrm<>'POS_HANDOVER_REQUIRES_SETTLED_PAYMENT' then raise;end if;end;
 settings:=public.laundry_pos_receipt_settings();
 perform public.laundry_pos_save_receipt_settings((settings->>'revision')::bigint,jsonb_set(settings->'config','{cs}','"QA CS"'));
 if public.laundry_pos_whatsapp_receipt(order_id,'NEW')->'settings'->'config'->>'cs'<>'QA CS' then raise exception 'stale template';end if;
 if has_table_privilege('anon','laundry_private.pos_order_contacts','select') or has_function_privilege('anon','public.laundry_pos_save_receipt_settings(bigint,jsonb)','execute')
 then raise exception 'receipt ACL leak';end if;
 cashier:=public.laundry_pos_owner_save_cashier(null,'WA QA Cashier','{"whatsapp_draft":true}',true);
 device:=public.laundry_pos_owner_pair_cashier(cashier,device_token);
 if not public.laundry_pos_cashier_login(device_token,'MAS-2001',login_token) then raise exception 'WA QA login failed';end if;
 perform set_config('request.jwt.claim.sub','',true);
 if public.laundry_pos_whatsapp_receipt(order_id,'NEW',device_token,login_token)->>'invoice' is null then raise exception 'authorized cashier cannot read receipt';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.laundry_pos_owner_save_cashier(cashier,'WA QA Cashier','{"whatsapp_draft":false}',true);
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.laundry_pos_whatsapp_receipt(order_id,'NEW',device_token,login_token);raise exception 'revoked WA permission retained access';
 exception when insufficient_privilege then null;end;

 begin
  perform public.laundry_pos_whatsapp_receipt(order_id,'NEW');raise exception 'anonymous receipt exposed';
 exception when insufficient_privilege then null;end;
end; $test$;
rollback;
