-- Synthetic fixtures only. This test always rolls back; no real QR is read.
begin;
create temporary table public_history_test_context(active_digest text,revoked_digest text,inactive_digest text,other_digest text);
grant select on public_history_test_context to anon;
do $setup$
declare o uuid:=gen_random_uuid(); m uuid; other_m uuid; inactive_m uuid; e uuid; idx integer;
 d text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 revoked text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 inactive text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 other_d text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
begin
 insert into auth.users(id,aud,role) values(o,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(o,true);
 insert into public.laundry_members(display_name,created_by) values('Synthetic public history',o) returning id into m;
 insert into public.laundry_members(display_name,created_by) values('Other synthetic member',o) returning id into other_m;
 insert into public.laundry_members(display_name,created_by,is_active) values('Inactive synthetic member',o,false) returning id into inactive_m;
 insert into public.laundry_member_cards(member_id,token_digest,token_ciphertext,issued_by)
 values(m,decode(d,'hex'),decode(repeat('ab',60),'hex'),o),(other_m,decode(other_d,'hex'),decode(repeat('ab',60),'hex'),o),(inactive_m,decode(inactive,'hex'),decode(repeat('ab',60),'hex'),o);
 insert into public.laundry_member_cards(member_id,token_digest,token_ciphertext,issued_by,revoked_at,revoked_by,revoked_reason)
 values(m,decode(revoked,'hex'),decode(repeat('ab',60),'hex'),o,now(),o,'Synthetic replacement');
 for idx in 1..23 loop
  insert into public.laundry_checklist_events(member_id,event_type,actor_id,request_id,occurred_at)
  values(m,'ADD',o,gen_random_uuid(),'2026-01-01T00:00:00Z'::timestamptz+idx*interval '1 hour') returning id into e;
  insert into public.laundry_amount_transactions(visit_event_id,member_id,actor_id,amount_idr,description,program_year,awarded_points,rule_revision,occurred_at)
  values(e,m,o,75000,'PRIVATE NOTE MUST NOT BE PUBLIC',2026,5,1,'2026-01-01T00:00:00Z'::timestamptz+idx*interval '1 hour');
  if idx=23 then
   insert into public.laundry_checklist_events(member_id,event_type,reverses_event_id,reason,request_id,actor_id)
   values(m,'VOID',e,'PRIVATE CANCELLATION REASON',gen_random_uuid(),o);
  end if;
 end loop;
 -- Legacy record, future program and another member must stay distinguishable.
 insert into public.laundry_checklist_events(member_id,event_type,actor_id,request_id,occurred_at)
 values(m,'ADD',o,gen_random_uuid(),'2026-01-01T00:00:00Z');
 insert into public.laundry_checklist_events(member_id,event_type,actor_id,request_id,occurred_at)
 values(m,'ADD',o,gen_random_uuid(),'2027-01-01T00:00:00Z') returning id into e;
 insert into public.laundry_amount_transactions(visit_event_id,member_id,actor_id,amount_idr,description,program_year,awarded_points,rule_revision,occurred_at)
 values(e,m,o,200000,'PRIVATE FUTURE NOTE',2027,20,1,'2027-01-01T00:00:00Z');
 insert into public.laundry_checklist_events(member_id,event_type,actor_id,request_id)
 values(other_m,'ADD',o,gen_random_uuid());
 insert into public_history_test_context values(d,revoked,inactive,other_d);
end;
$setup$;
set local role anon;
do $verify$
declare c record; first_page jsonb; second_page jsonb; future_page jsonb; earned bigint; balance bigint; denied boolean:=false;
begin
 select * into c from public_history_test_context;
 first_page:=public.laundry_public_transaction_history(c.active_digest,2026,1);
 second_page:=public.laundry_public_transaction_history(c.active_digest,2026,2);
 future_page:=public.laundry_public_transaction_history(c.active_digest,2027,1);
 if jsonb_array_length(first_page->'transactions')<>20 or (first_page->>'has_older')::boolean is not true then raise exception 'first page boundary failed';end if;
 if jsonb_array_length(second_page->'transactions')<>4 or (second_page->>'has_older')::boolean is not false then raise exception 'second page boundary failed';end if;
 if jsonb_array_length(future_page->'transactions')<>1 then raise exception 'program years mixed';end if;
 if (first_page->'transactions'->0->>'cancelled')::boolean is not true then raise exception 'cancellation not reflected';end if;
 if second_page->'transactions'->3->>'amount_idr' is not null then raise exception 'legacy amount invented';end if;
 if first_page::text ~ 'PRIVATE|description|reason|actor_id|member_id|display_name|whatsapp' then raise exception 'private details disclosed';end if;
 select sum(case when (x->>'cancelled')::boolean then 0 else (x->>'awarded_points')::bigint end) into earned
 from jsonb_array_elements((first_page->'transactions')||(second_page->'transactions')) x;
 select points_total into balance from public.laundry_public_point_balances(c.active_digest) where program_year=2026;
 if earned is distinct from balance or balance<>110 then raise exception 'history does not reconcile to balance';end if;
 if public.laundry_public_transaction_history(c.revoked_digest,2026,1) is not null or public.laundry_public_transaction_history(c.inactive_digest,2026,1) is not null then raise exception 'invalid card authorization';end if;
 if public.laundry_public_transaction_history(repeat('0',64),2026,1) is not null or public.laundry_public_transaction_history('invalid',2026,1) is not null then raise exception 'unknown digest authorized';end if;
 if public.laundry_public_transaction_history(c.active_digest,2026,0) is not null or public.laundry_public_transaction_history(c.active_digest,2026,10001) is not null then raise exception 'unbounded pagination';end if;
 if jsonb_array_length(public.laundry_public_transaction_history(c.other_digest,2026,1)->'transactions')<>1 then raise exception 'cross-member history';end if;
 if exists(select 1 from jsonb_array_elements(first_page->'transactions') a join jsonb_array_elements(second_page->'transactions') b on a->>'event_id'=b->>'event_id') then raise exception 'pagination duplicated records';end if;
 begin perform * from public.laundry_amount_transactions; exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'anon table access granted';end if;
end;
$verify$;
reset role;
rollback;
