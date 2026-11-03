begin;
set local statement_timeout='25s';
do $test$
#variable_conflict use_variable
declare
 owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outlet_id uuid;
 service_id uuid:=gen_random_uuid(); order_id uuid; guest_id uuid; items jsonb;
 partial_id uuid:=gen_random_uuid(); final_id uuid:=gen_random_uuid(); refund_id uuid:=gen_random_uuid();
 open_id uuid:=gen_random_uuid(); cash_id uuid:=gen_random_uuid(); cancel_id uuid:=gen_random_uuid();
 result jsonb; result2 jsonb; owner_payment jsonb;
 cutoff timestamptz; second_owner uuid:=gen_random_uuid(); nonowner uuid:=gen_random_uuid(); staff_id uuid;
 device_token text:=repeat('O',43); login_token text:=repeat('P',43);
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 select o.id into strict outlet_id from public.laundry_pos_outlets o where singleton_key=1;
 update public.laundry_pos_outlets set write_enabled=false where id=outlet_id;
 begin
  perform public.laundry_pos_owner_open_shift(open_id);
  raise exception 'owner opened shift with switch off';
 exception when insufficient_privilege then null;end;
 insert into public.laundry_members(id,member_number,display_name,created_by) overriding system value
 values(member_id,987654322,'Owner Ops Member QA',owner_id);
 insert into public.laundry_services(id,category,name,unit,price_idr,duration)
 values(service_id,'QA','Owner Ops Service','kg',93000,'6 jam');
 items:=jsonb_build_array(jsonb_build_object('service_id',service_id,'quantity','1','revision',1));
 update public.laundry_pos_outlets set write_enabled=true where id=outlet_id;
 begin
  perform public.laundry_pos_owner_open_shift(open_id);
  raise exception 'order switch implicitly enabled finance';
 exception when insufficient_privilege then null;end;
 update public.laundry_pos_outlets set finance_enabled=true where id=outlet_id;
 result:=public.laundry_pos_owner_open_shift(open_id);
 if result->>'status'<>'OPEN' or result<>public.laundry_pos_owner_open_shift(open_id)
 then raise exception 'owner shift replay failed';end if;
 if not exists(select 1 from public.laundry_pos_cash_shifts s where s.id=(result->>'shift_id')::uuid
  and s.opened_by=owner_id and s.opened_staff_id is null) then raise exception 'owner shift actor lost';end if;
 order_id:=(public.laundry_pos_owner_create_order(gen_random_uuid(),null,'987654322',items,null,null)->>'order_id')::uuid;
 result:=public.laundry_pos_owner_payment(partial_id,order_id,'30000','CASH',1);
 if result->>'payment_status'<>'PARTIAL' or result->>'points_awarded'<>'0'
 or exists(select 1 from public.laundry_pos_point_links p where p.order_id=order_id)
 then raise exception 'owner partial awarded early';end if;
 owner_payment:=public.laundry_pos_owner_payment(final_id,order_id,'63000','NONCASH',2);
 if owner_payment->>'payment_status'<>'PAID' or owner_payment->>'points_awarded'<>'5'
 then raise exception 'owner final award failed %',owner_payment;end if;
 if not exists(select 1 from public.laundry_amount_transactions t where t.member_id=member_id
  and t.actor_id=owner_id and t.actor_staff_id is null and t.amount_idr=93000 and t.awarded_points=5)
 or (select count(*) from public.laundry_pos_point_links p where p.order_id=order_id and p.link_type='ADD')<>1
 then raise exception 'owner award provenance failed';end if;
 if exists(select 1 from public.laundry_pos_point_links p join public.laundry_checklist_events e on e.id=p.event_id
  where p.order_id=order_id and p.created_at<>e.occurred_at)
 then raise exception 'point link uses a different time boundary';end if;
 if exists(select 1 from public.laundry_pos_payments p where p.order_id=order_id
  and (p.confirmed_by is distinct from owner_id or p.confirmed_staff_id is not null))
 then raise exception 'owner receipt actor failed';end if;
 if public.laundry_pos_owner_payment(final_id,order_id,'63000','NONCASH',2)<>owner_payment
 then raise exception 'owner final replay failed';end if;
 begin
  perform public.laundry_record_visit(member_id,gen_random_uuid());
  raise exception 'legacy manual award bypassed cutover guard';
 exception when insufficient_privilege then null;end;
 begin
  perform public.laundry_pos_owner_cancel_order(cancel_id,order_id,'Cancel paid QA',3);
  raise exception 'paid cancellation skipped refund';
 exception when invalid_parameter_value then
  if sqlerrm<>'POS_REFUND_REQUIRED' then raise;end if;
 end;
 result:=public.laundry_pos_owner_refund_full(refund_id,order_id,'Owner refund QA',3);
 if result->>'refunded_idr'<>'93000' or result->>'point_reversed'<>'true'
 or public.laundry_pos_owner_refund_full(refund_id,order_id,'Owner refund QA',3)<>result
 then raise exception 'owner refund/replay failed';end if;
 if not exists(select 1 from public.laundry_checklist_events e join public.laundry_pos_point_links p on p.event_id=e.id
  where p.order_id=order_id and p.link_type='VOID' and e.actor_id=owner_id and e.actor_staff_id is null)
 then raise exception 'owner VOID actor failed';end if;
 perform public.laundry_pos_owner_cancel_order(gen_random_uuid(),order_id,'Cancel refunded QA',4);
 guest_id:=(public.laundry_pos_owner_create_order(gen_random_uuid(),'Unpaid Guest QA',null,items,null,null)->>'order_id')::uuid;
 cutoff:=clock_timestamp();
 result:=public.laundry_pos_owner_cancel_order(gen_random_uuid(),guest_id,'Cancel unpaid QA',1);
 if result->>'lifecycle_status'<>'CANCELLED' then raise exception 'unpaid cancel failed';end if;
 if (public.laundry_pos_owner_report(cutoff-interval '1 day',cutoff)->>'receivables_as_of_end_idr')<>'93000'
 then raise exception 'later cancellation changed historical receivable';end if;
 guest_id:=(public.laundry_pos_owner_create_order(gen_random_uuid(),'Work Guest QA',null,items,null,null)->>'order_id')::uuid;
 if (public.laundry_pos_owner_work_status(gen_random_uuid(),guest_id,'READY')->>'work_status')<>'READY'
 then raise exception 'owner work command failed';end if;
 result:=public.laundry_pos_owner_cash_entry(cash_id,'IN','1000','Owner cash QA');
 if result<>public.laundry_pos_owner_cash_entry(cash_id,'IN','1000','Owner cash QA')
 then raise exception 'owner cash retry failed';end if;
 if (public.laundry_pos_owner_cash_overview()->>'expected_cash_idr')<>'1000'
 or (public.laundry_pos_owner_financial(order_id)->>'payment_status')<>'REFUNDED'
 or (public.laundry_pos_owner_report(clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day')->>'net_pos_points')<>'0'
 then raise exception 'owner reports inconsistent';end if;
 if exists(select 1 from public.laundry_pos_cash_ledger l where l.outlet_id=outlet_id
  and (l.created_by is distinct from owner_id or l.created_staff_id is not null))
 then raise exception 'owner cash actor failed';end if;
 update public.laundry_pos_outlets set write_enabled=false where id=outlet_id;
 if (public.laundry_pos_owner_command_result(final_id)->'result')<>owner_payment
 or public.laundry_pos_owner_command_result(gen_random_uuid()) <> '{"found":false}'::jsonb
 then raise exception 'command recovery failed';end if;
 if public.laundry_pos_owner_payment(final_id,order_id,'63000','NONCASH',2)<>owner_payment
 then raise exception 'flag-off owner payment replay failed';end if;
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=false where id=outlet_id;
 staff_id:=public.laundry_pos_owner_save_cashier(null,'Owner isolation cashier QA',
  '{"order_view":true,"payment_collect":true,"refund_full":true}'::jsonb,true);
 perform public.laundry_pos_owner_pair_cashier(staff_id,device_token);
 if not public.laundry_pos_cashier_login(device_token,
  (select s.username from public.laundry_pos_staff s where s.staff_id=staff_id),login_token)
 then raise exception 'isolation cashier fixture failed';end if;
 if public.laundry_pos_g4_command_result(device_token,login_token,final_id)<>'{"found":false}'::jsonb
 then raise exception 'cashier read owner command result';end if;
 begin
  perform public.laundry_pos_g5_payment(device_token,login_token,gen_random_uuid(),guest_id,'1','CASH',1);
  raise exception 'cashier payment bypassed finance switch';
 exception when insufficient_privilege then null;end;
 begin
  perform public.laundry_pos_g5_refund_full(device_token,login_token,gen_random_uuid(),order_id,'Finance disabled QA',1);
  raise exception 'cashier refund bypassed finance switch';
 exception when insufficient_privilege then null;end;
 if public.laundry_pos_owner_payment(final_id,order_id,'63000','NONCASH',2)<>owner_payment
 then raise exception 'finance-off owner replay failed';end if;
 begin
  perform public.laundry_pos_owner_cash_entry(gen_random_uuid(),'IN','1','Disabled cash QA');
  raise exception 'owner cash wrote with switch off';
 exception when insufficient_privilege then null;end;
 update public.laundry_pos_outlets set write_enabled=true,finance_enabled=true where id=outlet_id;
 result:=public.laundry_pos_owner_close_shift(gen_random_uuid(),'1000',null);
 if result->>'discrepancy_idr'<>'0' then raise exception 'owner close amount failed';end if;
 if not exists(select 1 from public.laundry_pos_cash_shifts s where s.id=(result->>'shift_id')::uuid
  and s.closed_by=owner_id and s.closed_staff_id is null) then raise exception 'owner close actor failed';end if;
 insert into auth.users(id,aud,role) values(second_owner,'authenticated','authenticated'),(nonowner,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(second_owner,true);
 perform set_config('request.jwt.claim.sub',second_owner::text,true);
 if public.laundry_pos_owner_command_result(final_id)<>'{"found":false}'::jsonb
 then raise exception 'second owner read another actor command result';end if;
 perform set_config('request.jwt.claim.sub',nonowner::text,true);
 execute 'set local role authenticated';
 begin
  perform public.laundry_pos_owner_cash_overview();
  raise exception 'authenticated nonowner read financial data';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 execute 'set local role anon';
 begin
  perform public.laundry_pos_owner_open_shift(gen_random_uuid());
  raise exception 'anon reached owner operation';
 exception when insufficient_privilege then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.laundry_owner_accounts set is_active=false where auth_user_id=owner_id;
 begin
  perform public.laundry_pos_owner_payment(final_id,order_id,'63000','NONCASH',2);
  raise exception 'revoked owner replay allowed';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.laundry_pos_owner_cash_overview();
  raise exception 'nonowner financial read allowed';
 exception when insufficient_privilege then null;end;
end;
$test$;
rollback;
