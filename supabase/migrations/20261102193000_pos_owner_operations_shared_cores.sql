-- Independent finance gate remains false until separately approved activation.
alter table public.laundry_pos_outlets add column finance_enabled boolean not null default false;

create function laundry_private.pos_owner_outlet()
returns uuid language plpgsql security definer set search_path='' stable as $$
declare outlet_id uuid;
begin
 perform laundry_private.pos_owner_required();
 select o.id into outlet_id from public.laundry_pos_outlets o where o.singleton_key=1 and o.active;
 if outlet_id is null then raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 return outlet_id;
end; $$;
revoke all on function laundry_private.pos_owner_outlet() from public,anon,authenticated;

create function laundry_private.pos_open_shift_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_hash bytea; v_old record; v_id uuid; v_result jsonb;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null then raise exception 'POS_REQUEST_ID_REQUIRED' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('operation','OPEN_SHIFT','outlet',p_outlet)::text,'sha256');
 select c.actor_id,c.actor_staff_id,c.operation,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.operation<>'OPEN_SHIFT'
      or v_old.payload_digest<>v_hash then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets o
 where o.id=p_outlet and o.active and o.write_enabled and o.finance_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_id,c.actor_staff_id,c.operation,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.operation<>'OPEN_SHIFT'
      or v_old.payload_digest<>v_hash then
      raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 select s.id into v_id from public.laundry_pos_cash_shifts s
 where s.outlet_id=p_outlet and s.register_code='MAIN' and s.closed_at is null for update;
 if v_id is null then
  insert into public.laundry_pos_cash_shifts(outlet_id,register_code,opened_by,opened_staff_id,opening_idr)
  values(p_outlet,'MAIN',p_owner,p_staff,0) returning id into v_id;
 end if;
 v_result:=pg_catalog.jsonb_build_object('shift_id',v_id,'status','OPEN');
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,operation,target_id,payload_digest,result)
 values(p_request_id,p_outlet,p_owner,p_staff,'OPEN_SHIFT',v_id,v_hash,v_result);
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_open_shift_core(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function laundry_private.pos_g5_open_shift(p_device_token text,p_login_token text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'payment_collect',false) z;
 return laundry_private.pos_open_shift_core(null,actor.staff_id,actor.outlet_id,p_request_id);
end; $$;
revoke all on function laundry_private.pos_g5_open_shift(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_open_shift(text,text,uuid) to anon,authenticated;

create function laundry_private.pos_owner_open_shift(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_open_shift_core(owner_id,null,outlet_id,p_request_id);
end; $$;
revoke all on function laundry_private.pos_owner_open_shift(uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_open_shift(uuid) to authenticated;
create function public.laundry_pos_owner_open_shift(p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_open_shift(p_request_id); $$;
revoke all on function public.laundry_pos_owner_open_shift(uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_open_shift(uuid) to authenticated;

create function laundry_private.pos_financial_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare o record; v_paid bigint; v_refunded bigint; v_shift uuid; v_receipts jsonb;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 select id,total_idr,refund_status,lifecycle_status,version,member_id into o
 from public.laundry_pos_orders where id=p_order_id and outlet_id=p_outlet;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='22023';end if;
 select coalesce(sum(case when entry_type='RECEIPT' then amount_idr else 0 end),0),
        coalesce(sum(case when entry_type='REFUND' then amount_idr else 0 end),0)
 into v_paid,v_refunded from public.laundry_pos_payments where order_id=p_order_id;
 select id into v_shift from public.laundry_pos_cash_shifts
 where outlet_id=p_outlet and register_code='MAIN' and closed_at is null limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',entry_type,'method',method,
   'amount_idr',amount_idr::text,'at',confirmed_at) order by confirmed_at,id),'[]'::jsonb)
 into v_receipts from public.laundry_pos_payments where order_id=p_order_id;
 return jsonb_build_object('order_id',p_order_id,'total_idr',o.total_idr::text,
  'paid_idr',v_paid::text,'refunded_idr',v_refunded::text,
  'remaining_idr',(case when o.refund_status='FULLY_REFUNDED' then 0
     else greatest(o.total_idr-v_paid,0) end)::text,
  'payment_status',case when o.refund_status='FULLY_REFUNDED' then 'REFUNDED'
    when o.total_idr=0 then 'ZERO_TOTAL' when v_paid=0 then 'UNPAID'
    when v_paid=o.total_idr then 'PAID' else 'PARTIAL' end,
  'refund_status',o.refund_status,'version',o.version,
  'shift_open',v_shift is not null,'receipts',v_receipts);
end;
$$;
revoke all on function laundry_private.pos_financial_core(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function laundry_private.pos_g5_financial(p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'order_view',false) z;
 return laundry_private.pos_financial_core(null,actor.staff_id,actor.outlet_id,p_order_id);
end; $$;
revoke all on function laundry_private.pos_g5_financial(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_financial(text,text,uuid) to anon,authenticated;

create function laundry_private.pos_owner_financial(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_financial_core(owner_id,null,outlet_id,p_order_id);
end; $$;
revoke all on function laundry_private.pos_owner_financial(uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_financial(uuid) to authenticated;
create function public.laundry_pos_owner_financial(p_order_id uuid)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_owner_financial(p_order_id); $$;
revoke all on function public.laundry_pos_owner_financial(uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_financial(uuid) to authenticated;

create function laundry_private.pos_payment_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid,p_order_id uuid,
 p_amount_idr text,p_method text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o record; s record; v_old record;
 v_hash bytea; v_result jsonb; v_amount bigint; v_paid bigint; v_year integer;
 v_now timestamptz; v_rule record; v_tier jsonb; v_points integer:=0;
 v_event uuid; v_receipt uuid; v_ledger uuid; v_is_final boolean;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null or p_order_id is null or p_expected_version is null or p_expected_version<1
  or p_amount_idr is null or p_amount_idr !~ '^[1-9][0-9]{0,9}$'
  or p_method not in ('CASH','NONCASH') then
    raise exception 'POS_PAYMENT_INVALID' using errcode='22023';end if;
 v_amount:=p_amount_idr::bigint;
 if v_amount>1000000000 then raise exception 'POS_PAYMENT_LIMIT' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('operation','PAYMENT','order',p_order_id,
   'amount',p_amount_idr,'method',p_method,'version',p_expected_version)::text,'sha256');
 select c.actor_id,c.actor_staff_id,c.operation,c.outlet_id,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.operation<>'PAYMENT'
   or v_old.outlet_id<>p_outlet or v_old.payload_digest<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 -- Lock the one outlet first, then invoice, then open shift, then member/year.
 perform 1 from public.laundry_pos_outlets where id=p_outlet and active and write_enabled and finance_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_id,c.actor_staff_id,c.operation,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.operation<>'PAYMENT'
   or v_old.payload_digest<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 select * into o from public.laundry_pos_orders where id=p_order_id
   and outlet_id=p_outlet and lifecycle_status='CONFIRMED' for update;
 if not found or o.refund_status<>'NONE' or o.total_idr=0 then
   raise exception 'POS_ORDER_NOT_PAYABLE' using errcode='22023';end if;
 if o.version<>p_expected_version then raise exception 'POS_ORDER_VERSION_CONFLICT' using errcode='22023';end if;
 select coalesce(sum(amount_idr),0) into v_paid
 from public.laundry_pos_payments where order_id=p_order_id and entry_type='RECEIPT';
 if v_amount>o.total_idr-v_paid then raise exception 'POS_OVERPAYMENT' using errcode='22023';end if;
 select id into s from public.laundry_pos_cash_shifts where outlet_id=p_outlet
   and register_code='MAIN' and closed_at is null for update;
 if not found then raise exception 'POS_SHIFT_NOT_OPEN' using errcode='22023';end if;
 v_is_final:=(v_paid+v_amount=o.total_idr);
 if v_is_final and o.member_id is not null then
   perform 1 from public.laundry_members m where m.id=o.member_id and m.is_active for share;
   if not found then raise exception 'POS_MEMBER_INACTIVE' using errcode='22023';end if;
   -- Rule-row lock waits may cross the program-year boundary.
   loop
    v_now:=clock_timestamp();
    v_year:=extract(year from timezone('Asia/Jakarta',v_now))::integer;
    select r.tiers,r.revision into v_rule from public.laundry_point_rules r
     where r.program_year=v_year for share;
    if not found then raise exception 'POINT_RULE_MISSING' using errcode='22023';end if;
    v_now:=clock_timestamp();
    exit when extract(year from timezone('Asia/Jakarta',v_now))::integer=v_year;
   end loop;
   for v_tier in select value from pg_catalog.jsonb_array_elements(v_rule.tiers)
    order by (value->>'minimum')::bigint loop
    if o.total_idr >= (v_tier->>'minimum')::bigint then
      v_points:=(v_tier->>'points')::integer;
    end if;
   end loop;
 else
   v_now:=clock_timestamp();
 end if;
 -- Calculate result *before* first write. Commands are immutable (no UPDATE).
 v_receipt:=gen_random_uuid();
 if v_is_final and o.member_id is not null then v_event:=gen_random_uuid();end if;
 v_result:=pg_catalog.jsonb_build_object('order_id',p_order_id,'payment_id',v_receipt,
   'received_idr',v_amount::text,'paid_idr',(v_paid+v_amount)::text,
   'remaining_idr',(o.total_idr-v_paid-v_amount)::text,'payment_status',
   case when v_is_final then 'PAID' else 'PARTIAL' end,
   'points_awarded',case when v_is_final and o.member_id is not null then v_points else 0 end,
   'version',o.version+1);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,operation,target_id,payload_digest,result)
  values(p_request_id,p_outlet,p_owner,p_staff,'PAYMENT',p_order_id,v_hash,v_result);
 insert into public.laundry_pos_payments(id,order_id,outlet_id,command_id,shift_id,entry_type,method,amount_idr,
       confirmed_by,confirmed_staff_id,confirmed_at)
  values(v_receipt,p_order_id,p_outlet,p_request_id,s.id,'RECEIPT',p_method,v_amount,p_owner,p_staff,v_now);
 insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,payment_id,command_id,direction,method,
     amount_idr,category,created_by,created_staff_id,occurred_at)
  values(p_outlet,s.id,v_receipt,p_request_id,'IN',p_method,v_amount,'PAYMENT',p_owner,p_staff,v_now);
 if v_is_final and o.member_id is not null then
   insert into public.laundry_checklist_events(id,member_id,event_type,request_id,actor_id,actor_staff_id,occurred_at)
    values(v_event,o.member_id,'ADD',p_request_id,p_owner,p_staff,v_now);
   insert into public.laundry_amount_transactions(visit_event_id,member_id,actor_id,actor_staff_id,
       amount_idr,description,program_year,awarded_points,rule_revision,occurred_at)
    values(v_event,o.member_id,p_owner,p_staff,o.total_idr,'POS '||o.invoice_no,
      v_year,v_points,v_rule.revision,v_now);
   insert into public.laundry_pos_point_links(order_id,link_type,event_id,member_id,program_year,
      amount_idr,awarded_points,rule_revision,command_id,created_at)
    values(p_order_id,'ADD',v_event,o.member_id,v_year,o.total_idr,v_points,v_rule.revision,p_request_id,v_now);
 end if;
 update public.laundry_pos_orders set version=version+1 where id=p_order_id;
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_payment_core(uuid,uuid,uuid,uuid,uuid,text,text,bigint) from public,anon,authenticated;

create or replace function laundry_private.pos_g5_payment(p_device_token text,p_login_token text,p_request_id uuid,p_order_id uuid,p_amount_idr text,p_method text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'payment_collect',false) z;
 return laundry_private.pos_payment_core(null,actor.staff_id,actor.outlet_id,p_request_id,p_order_id,p_amount_idr,p_method,p_expected_version);
end; $$;
revoke all on function laundry_private.pos_g5_payment(text,text,uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_payment(text,text,uuid,uuid,text,text,bigint) to anon,authenticated;

create function laundry_private.pos_owner_payment(p_request_id uuid,p_order_id uuid,p_amount_idr text,p_method text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_payment_core(owner_id,null,outlet_id,p_request_id,p_order_id,p_amount_idr,p_method,p_expected_version);
end; $$;
revoke all on function laundry_private.pos_owner_payment(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_payment(uuid,uuid,text,text,bigint) to authenticated;
create function public.laundry_pos_owner_payment(p_request_id uuid,p_order_id uuid,p_amount_idr text,p_method text,p_expected_version bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_payment(p_request_id,p_order_id,p_amount_idr,p_method,p_expected_version); $$;
revoke all on function public.laundry_pos_owner_payment(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_payment(uuid,uuid,text,text,bigint) to authenticated;

create function laundry_private.pos_refund_full_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid,
 p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o record; s record; c record; v_old record; v_link record;
 v_hash bytea; v_result jsonb; v_total bigint:=0; v_count integer:=0;
 v_refund uuid; v_void uuid; v_now timestamptz;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null or p_order_id is null or p_expected_version is null or p_expected_version<1
 or p_reason is null or length(btrim(p_reason)) not between 3 and 300
 or p_reason ~ '[[:cntrl:]]' then raise exception 'POS_REFUND_INVALID' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('operation','FULL_REFUND','order',p_order_id,
    'reason',btrim(p_reason),'version',p_expected_version)::text,'sha256');
 select x.actor_id,x.actor_staff_id,x.operation,x.outlet_id,x.payload_digest,x.result into v_old
 from public.laundry_pos_commands x where x.request_id=p_request_id;
 if found then
  if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.operation<>'FULL_REFUND'
     or v_old.outlet_id<>p_outlet or v_old.payload_digest<>v_hash then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets where id=p_outlet and active and write_enabled and finance_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select x.actor_id,x.actor_staff_id,x.operation,x.outlet_id,x.payload_digest,x.result into v_old
 from public.laundry_pos_commands x where x.request_id=p_request_id;
 if found then
  if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.operation<>'FULL_REFUND'
     or v_old.outlet_id<>p_outlet or v_old.payload_digest<>v_hash then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 select * into o from public.laundry_pos_orders where id=p_order_id
 and outlet_id=p_outlet and lifecycle_status='CONFIRMED' for update;
 if not found or o.refund_status<>'NONE' or o.total_idr=0 then
  raise exception 'POS_REFUND_ORDER_INVALID' using errcode='22023';end if;
 if o.version<>p_expected_version then raise exception 'POS_ORDER_VERSION_CONFLICT' using errcode='22023';end if;
 select id into s from public.laundry_pos_cash_shifts where outlet_id=p_outlet
  and register_code='MAIN' and closed_at is null for update;
 if not found then raise exception 'POS_SHIFT_NOT_OPEN' using errcode='22023';end if;
 select coalesce(sum(p.amount_idr),0),count(*) into v_total,v_count
 from public.laundry_pos_payments p where p.order_id=p_order_id and p.entry_type='RECEIPT';
 if v_count=0 then raise exception 'POS_NOTHING_TO_REFUND' using errcode='22023';end if;
 if exists(select 1 from public.laundry_pos_payments p
  where p.order_id=p_order_id and p.entry_type='REFUND') then
  raise exception 'POS_REFUND_ALREADY_POSTED' using errcode='22023';end if;
 select pl.* into v_link from public.laundry_pos_point_links pl
 where pl.order_id=p_order_id and pl.link_type='ADD' and pl.award_cycle=1;
 v_now:=clock_timestamp();
 v_result:=pg_catalog.jsonb_build_object('order_id',p_order_id,'refunded_idr',v_total::text,
  'refund_count',v_count,'payment_status','REFUNDED','version',o.version+1,
  'point_reversed',v_link.id is not null);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,operation,target_id,payload_digest,result)
  values(p_request_id,p_outlet,p_owner,p_staff,'FULL_REFUND',p_order_id,v_hash,v_result);
 for c in select p.id,p.method,p.amount_idr from public.laundry_pos_payments p
  where p.order_id=p_order_id and p.entry_type='RECEIPT' order by p.confirmed_at,p.id
 loop
  v_refund:=gen_random_uuid();
  insert into public.laundry_pos_payments(id,order_id,outlet_id,command_id,shift_id,
    entry_type,original_receipt_id,method,amount_idr,confirmed_by,confirmed_staff_id,confirmed_at)
  values(v_refund,p_order_id,p_outlet,p_request_id,s.id,'REFUND',c.id,c.method,c.amount_idr,p_owner,p_staff,v_now);
  insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,payment_id,command_id,direction,method,
    amount_idr,category,created_by,created_staff_id,occurred_at)
  values(p_outlet,s.id,v_refund,p_request_id,'OUT',c.method,c.amount_idr,'REFUND',p_owner,p_staff,v_now);
 end loop;
 if v_link.id is not null then
  v_void:=gen_random_uuid();
  insert into public.laundry_checklist_events(id,member_id,event_type,reverses_event_id,
    reason,request_id,actor_id,actor_staff_id,occurred_at)
  values(v_void,v_link.member_id,'VOID',v_link.event_id,btrim(p_reason),gen_random_uuid(),p_owner,p_staff,v_now);
  insert into public.laundry_pos_point_links(order_id,award_cycle,link_type,event_id,member_id,
    program_year,amount_idr,awarded_points,rule_revision,command_id,created_at)
  values(p_order_id,1,'VOID',v_void,v_link.member_id,v_link.program_year,v_link.amount_idr,
    v_link.awarded_points,v_link.rule_revision,p_request_id,v_now);
 end if;
 update public.laundry_pos_orders set refund_status='FULLY_REFUNDED',version=version+1
  where id=p_order_id;
 insert into public.laundry_pos_order_events(order_id,command_id,actor_id,actor_staff_id,kind,reason,data)
  values(p_order_id,p_request_id,p_owner,p_staff,'FULL_REFUND',btrim(p_reason),
    pg_catalog.jsonb_build_object('amount_idr',v_total::text,'count',v_count));
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_refund_full_core(uuid,uuid,uuid,uuid,uuid,text,bigint) from public,anon,authenticated;

create or replace function laundry_private.pos_g5_refund_full(p_device_token text,p_login_token text,p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'refund_full',false) z;
 return laundry_private.pos_refund_full_core(null,actor.staff_id,actor.outlet_id,p_request_id,p_order_id,p_reason,p_expected_version);
end; $$;
revoke all on function laundry_private.pos_g5_refund_full(text,text,uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_refund_full(text,text,uuid,uuid,text,bigint) to anon,authenticated;

create function laundry_private.pos_owner_refund_full(p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_refund_full_core(owner_id,null,outlet_id,p_request_id,p_order_id,p_reason,p_expected_version);
end; $$;
revoke all on function laundry_private.pos_owner_refund_full(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_refund_full(uuid,uuid,text,bigint) to authenticated;
create function public.laundry_pos_owner_refund_full(p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_refund_full(p_request_id,p_order_id,p_reason,p_expected_version); $$;
revoke all on function public.laundry_pos_owner_refund_full(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_refund_full(uuid,uuid,text,bigint) to authenticated;

create function laundry_private.pos_cash_overview_core(p_owner uuid,p_staff uuid,p_outlet uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare s record; v_cash bigint:=0; v_in bigint:=0; v_out bigint:=0; v_entries jsonb;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 select * into s from public.laundry_pos_cash_shifts
  where outlet_id=p_outlet and register_code='MAIN' and closed_at is null;
 if found then
  select coalesce(sum(case when method='CASH' and direction='IN' then amount_idr else 0 end),0),
         coalesce(sum(case when method='CASH' and direction='OUT' then amount_idr else 0 end),0)
   into v_in,v_out from public.laundry_pos_cash_ledger where shift_id=s.id;
  v_cash:=s.opening_idr+v_in-v_out;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('direction',x.direction,'category',x.category,
   'method',x.method,'amount_idr',x.amount_idr::text,'note',x.note,'occurred_at',x.occurred_at,
   'invoice_no',x.invoice_no,'shift_id',x.shift_id) order by x.occurred_at desc,x.id desc),'[]'::jsonb)
 into v_entries from (
  select l.id,l.direction,l.category,l.method,l.amount_idr,l.note,l.occurred_at,l.shift_id,
    o.invoice_no from public.laundry_pos_cash_ledger l
  left join public.laundry_pos_payments p on p.id=l.payment_id
  left join public.laundry_pos_orders o on o.id=p.order_id
  where l.outlet_id=p_outlet order by l.occurred_at desc,l.id desc limit 80
 ) x;
 return jsonb_build_object('open',s.id is not null,'shift_id',s.id,
   'opened_at',s.opened_at,'opening_idr',coalesce(s.opening_idr,0)::text,
   'cash_in_idr',v_in::text,'cash_out_idr',v_out::text,
   'expected_cash_idr',v_cash::text,'write_enabled',(
    select o.write_enabled from public.laundry_pos_outlets o where o.id=p_outlet),
   'finance_enabled',(select o.write_enabled and o.finance_enabled from public.laundry_pos_outlets o where o.id=p_outlet),
   'entries',v_entries);
end;
$$;
revoke all on function laundry_private.pos_cash_overview_core(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function laundry_private.pos_g6_cash_overview(p_device_token text,p_login_token text)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'cash_view',false) z;
 return laundry_private.pos_cash_overview_core(null,actor.staff_id,actor.outlet_id);
end; $$;
revoke all on function laundry_private.pos_g6_cash_overview(text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6_cash_overview(text,text) to anon,authenticated;

create function laundry_private.pos_owner_cash_overview()
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_cash_overview_core(owner_id,null,outlet_id);
end; $$;
revoke all on function laundry_private.pos_owner_cash_overview() from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_cash_overview() to authenticated;
create function public.laundry_pos_owner_cash_overview()
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_owner_cash_overview(); $$;
revoke all on function public.laundry_pos_owner_cash_overview() from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_cash_overview() to authenticated;

create function laundry_private.pos_cash_entry_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid,
 p_direction text,p_amount_idr text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s record; v_old record; v_amount bigint; v_hash bytea;
        v_result jsonb; v_direction text:=p_direction; v_reason text:=btrim(coalesce(p_reason,''));
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null or v_direction not in ('IN','OUT') or
  p_amount_idr is null or p_amount_idr !~ '^[1-9][0-9]{0,9}$' or
  length(v_reason) not between 3 and 300 or v_reason ~ '[[:cntrl:]]' then
  raise exception 'POS_CASH_ENTRY_INVALID' using errcode='22023';end if;
 v_amount:=p_amount_idr::bigint;
 if v_amount>1000000000 then raise exception 'POS_CASH_LIMIT' using errcode='22023';end if;
 v_hash:=extensions.digest(jsonb_build_object('type','CASH_ENTRY','direction',v_direction,
   'amount',p_amount_idr,'reason',v_reason)::text,'sha256');
 select c.actor_id,c.actor_staff_id,c.operation,c.outlet_id,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.operation<>'CASH_ENTRY' or
   v_old.outlet_id<>p_outlet or v_old.payload_digest<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets o where o.id=p_outlet and o.active and o.write_enabled and o.finance_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_id,c.actor_staff_id,c.operation,c.outlet_id,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.operation<>'CASH_ENTRY' or
   v_old.outlet_id<>p_outlet or v_old.payload_digest<>v_hash then
    raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 select * into s from public.laundry_pos_cash_shifts where outlet_id=p_outlet and
   register_code='MAIN' and closed_at is null for update;
 if not found then raise exception 'POS_SHIFT_NOT_OPEN' using errcode='22023';end if;
 v_result:=jsonb_build_object('shift_id',s.id,'direction',v_direction,
   'amount_idr',v_amount::text,'status','POSTED');
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,
   operation,target_id,payload_digest,result)
 values(p_request_id,p_outlet,p_owner,p_staff,'CASH_ENTRY',s.id,v_hash,v_result);
 insert into public.laundry_pos_cash_ledger(outlet_id,shift_id,command_id,direction,
   method,amount_idr,category,note,created_by,created_staff_id)
 values(p_outlet,s.id,p_request_id,v_direction,'CASH',v_amount,
  case when v_direction='IN' then 'NON_SALE_IN' else 'NON_SALE_OUT' end,v_reason,p_owner,p_staff);
 return v_result;
end; $$;
revoke all on function laundry_private.pos_cash_entry_core(uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;

create or replace function laundry_private.pos_g6_cash_entry(p_device_token text,p_login_token text,p_request_id uuid,p_direction text,p_amount_idr text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'cash_entry',false) z;
 return laundry_private.pos_cash_entry_core(null,actor.staff_id,actor.outlet_id,p_request_id,p_direction,p_amount_idr,p_reason);
end; $$;
revoke all on function laundry_private.pos_g6_cash_entry(text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6_cash_entry(text,text,uuid,text,text,text) to anon,authenticated;

create function laundry_private.pos_owner_cash_entry(p_request_id uuid,p_direction text,p_amount_idr text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_cash_entry_core(owner_id,null,outlet_id,p_request_id,p_direction,p_amount_idr,p_reason);
end; $$;
revoke all on function laundry_private.pos_owner_cash_entry(uuid,text,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_cash_entry(uuid,text,text,text) to authenticated;
create function public.laundry_pos_owner_cash_entry(p_request_id uuid,p_direction text,p_amount_idr text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_cash_entry(p_request_id,p_direction,p_amount_idr,p_reason); $$;
revoke all on function public.laundry_pos_owner_cash_entry(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_cash_entry(uuid,text,text,text) to authenticated;

create function laundry_private.pos_close_shift_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid,p_counted_idr text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s record; v_old record; v_hash bytea; v_counted bigint; v_expected bigint;
  v_difference bigint; v_reason text:=btrim(coalesce(p_reason,'')); v_result jsonb;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null or p_counted_idr is null or p_counted_idr !~ '^(0|[1-9][0-9]{0,9})$' or
    length(v_reason)>300 or v_reason ~ '[[:cntrl:]]' then
   raise exception 'POS_SHIFT_CLOSE_INVALID' using errcode='22023';end if;
 v_counted:=p_counted_idr::bigint;
 if v_counted>1000000000 then raise exception 'POS_SHIFT_COUNT_LIMIT' using errcode='22023';end if;
 v_hash:=extensions.digest(jsonb_build_object('type','CLOSE_SHIFT',
  'counted',p_counted_idr,'reason',v_reason)::text,'sha256');
 select c.actor_id,c.actor_staff_id,c.outlet_id,c.operation,c.payload_digest,c.result into v_old
  from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.outlet_id<>p_outlet or
   v_old.operation<>'CLOSE_SHIFT' or v_old.payload_digest<>v_hash then
   raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets o where o.id=p_outlet and o.active and o.write_enabled and o.finance_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.actor_id,c.actor_staff_id,c.outlet_id,c.operation,c.payload_digest,c.result into v_old
 from public.laundry_pos_commands c where request_id=p_request_id;
 if found then
  if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.outlet_id<>p_outlet or
   v_old.operation<>'CLOSE_SHIFT' or v_old.payload_digest<>v_hash then
   raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return v_old.result;
 end if;
 select * into s from public.laundry_pos_cash_shifts where outlet_id=p_outlet and
    register_code='MAIN' and closed_at is null for update;
 if not found then raise exception 'POS_SHIFT_NOT_OPEN' using errcode='22023';end if;
 select s.opening_idr + coalesce(sum(case when method='CASH' then
   case when direction='IN' then amount_idr else -amount_idr end else 0 end),0)
 into v_expected from public.laundry_pos_cash_ledger where shift_id=s.id;
 v_difference:=v_counted-v_expected;
 if v_difference<>0 and length(v_reason)<3 then
   raise exception 'POS_SHIFT_DISCREPANCY_REQUIRES_REASON' using errcode='22023';end if;
 update public.laundry_pos_cash_shifts set closed_at=clock_timestamp(),
  closed_by=p_owner,closed_staff_id=p_staff,counted_idr=v_counted,discrepancy_idr=v_difference,
  close_reason=nullif(v_reason,'') where id=s.id;
 v_result:=jsonb_build_object('shift_id',s.id,'status','CLOSED',
  'expected_cash_idr',v_expected::text,'counted_idr',v_counted::text,
  'discrepancy_idr',v_difference::text);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,operation,
  target_id,payload_digest,result)
 values(p_request_id,p_outlet,p_owner,p_staff,'CLOSE_SHIFT',s.id,v_hash,v_result);
 return v_result;
end; $$;
revoke all on function laundry_private.pos_close_shift_core(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;

create or replace function laundry_private.pos_g6_close_shift(p_device_token text,p_login_token text,p_request_id uuid,p_counted_idr text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'cash_entry',false) z;
 return laundry_private.pos_close_shift_core(null,actor.staff_id,actor.outlet_id,p_request_id,p_counted_idr,p_reason);
end; $$;
revoke all on function laundry_private.pos_g6_close_shift(text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6_close_shift(text,text,uuid,text,text) to anon,authenticated;

create function laundry_private.pos_owner_close_shift(p_request_id uuid,p_counted_idr text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_close_shift_core(owner_id,null,outlet_id,p_request_id,p_counted_idr,p_reason);
end; $$;
revoke all on function laundry_private.pos_owner_close_shift(uuid,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_close_shift(uuid,text,text) to authenticated;
create function public.laundry_pos_owner_close_shift(p_request_id uuid,p_counted_idr text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_close_shift(p_request_id,p_counted_idr,p_reason); $$;
revoke all on function public.laundry_pos_owner_close_shift(uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_close_shift(uuid,text,text) to authenticated;

create function laundry_private.pos_report_core(
 p_owner uuid,p_staff uuid,p_outlet uuid,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_cash_in bigint;v_cash_out bigint;v_non_cash_in bigint;v_non_cash_out bigint;
 v_created bigint;v_receivable bigint;v_points bigint;v_entries jsonb;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end>p_start+interval '93 days' then
   raise exception 'POS_REPORT_INTERVAL_INVALID' using errcode='22023';end if;
 select coalesce(sum(case when method='CASH' and direction='IN' then amount_idr else 0 end),0),
  coalesce(sum(case when method='CASH' and direction='OUT' then amount_idr else 0 end),0),
  coalesce(sum(case when method='NONCASH' and direction='IN' then amount_idr else 0 end),0),
  coalesce(sum(case when method='NONCASH' and direction='OUT' then amount_idr else 0 end),0)
 into v_cash_in,v_cash_out,v_non_cash_in,v_non_cash_out
 from public.laundry_pos_cash_ledger where outlet_id=p_outlet and occurred_at>=p_start and occurred_at<p_end;
 select count(*) into v_created from public.laundry_pos_orders
 where outlet_id=p_outlet and created_at>=p_start and created_at<p_end;
 -- Receivables as-of p_end: full refunds excluded, only confirmed receipt sums
 -- up to cutoff count against the original receivable.
 select coalesce(sum(greatest(o.total_idr-coalesce(p.paid,0),0)),0) into v_receivable
 from public.laundry_pos_orders o
 left join lateral (select sum(x.amount_idr) paid from public.laundry_pos_payments x
   where x.order_id=o.id and x.entry_type='RECEIPT' and x.confirmed_at<p_end) p on true
 where o.outlet_id=p_outlet and o.created_at<p_end
   and (o.lifecycle_status='CONFIRMED' or (o.lifecycle_status='CANCELLED' and exists(
    select 1 from public.laundry_pos_order_events e where e.order_id=o.id
     and e.kind='ORDER_CANCELLED' and e.occurred_at>=p_end)))
   and not exists(select 1 from public.laundry_pos_payments x where x.order_id=o.id and
         x.entry_type='REFUND' and x.confirmed_at<p_end);
 select coalesce(sum(case when l.link_type='ADD' then l.awarded_points
                   when l.link_type='VOID' then -l.awarded_points else 0 end),0)
  into v_points from public.laundry_pos_point_links l
  join public.laundry_pos_orders o on o.id=l.order_id
  join public.laundry_checklist_events e on e.id=l.event_id
  where o.outlet_id=p_outlet and e.occurred_at>=p_start and e.occurred_at<p_end;
 select coalesce(jsonb_agg(jsonb_build_object('type',q.direction,'method',q.method,
   'category',q.category,'amount_idr',q.amount_idr::text,'invoice_no',q.invoice_no,
   'occurred_at',q.occurred_at,'note',q.note) order by q.occurred_at desc,q.id desc),'[]'::jsonb)
 into v_entries from (
  select l.id,l.direction,l.method,l.category,l.amount_idr,l.occurred_at,l.note,o.invoice_no
  from public.laundry_pos_cash_ledger l
  left join public.laundry_pos_payments p on p.id=l.payment_id
  left join public.laundry_pos_orders o on o.id=p.order_id
  where l.outlet_id=p_outlet and l.occurred_at>=p_start and l.occurred_at<p_end
  order by l.occurred_at desc,l.id desc limit 300
 ) q;
 return jsonb_build_object('schema_version',1,'start',p_start,'end_exclusive',p_end,
 'outlet','MJL','orders_created',v_created,
 'cash_in_idr',v_cash_in::text,'cash_out_idr',v_cash_out::text,
 'noncash_in_idr',v_non_cash_in::text,'noncash_out_idr',v_non_cash_out::text,
 'receivables_as_of_end_idr',v_receivable::text,'net_pos_points',v_points,
 'rows',v_entries,'truncated',(
   select count(*)>300 from public.laundry_pos_cash_ledger
   where outlet_id=p_outlet and occurred_at>=p_start and occurred_at<p_end));
end; $$;
revoke all on function laundry_private.pos_report_core(uuid,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;

create or replace function laundry_private.pos_g6_report(p_device_token text,p_login_token text,p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'reports_view',false) z;
 return laundry_private.pos_report_core(null,actor.staff_id,actor.outlet_id,p_start,p_end);
end; $$;
revoke all on function laundry_private.pos_g6_report(text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6_report(text,text,timestamptz,timestamptz) to anon,authenticated;

create function laundry_private.pos_owner_report(p_start timestamptz,p_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_report_core(owner_id,null,outlet_id,p_start,p_end);
end; $$;
revoke all on function laundry_private.pos_owner_report(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_report(timestamptz,timestamptz) to authenticated;
create function public.laundry_pos_owner_report(p_start timestamptz,p_end timestamptz)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_owner_report(p_start,p_end); $$;
revoke all on function public.laundry_pos_owner_report(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_report(timestamptz,timestamptz) to authenticated;

create function laundry_private.pos_work_status_core(p_owner uuid,p_staff uuid,p_outlet uuid,
 p_request_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o record; v_hash bytea; v_old record; v_result jsonb;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null or p_order_id is null or p_new_status not in ('READY','COLLECTED') then
   raise exception 'POS_WORK_REQUEST_INVALID' using errcode='22023';end if;
 v_hash:=extensions.digest(pg_catalog.jsonb_build_object('order',p_order_id,'to',p_new_status)::text,'sha256');
 select c.actor_id,c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.payload_digest<>v_hash then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 perform 1 from public.laundry_pos_outlets where id=p_outlet and active and write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 -- Two concurrent same-ID requests serialize through the one outlet lock.
 -- The second request rechecks the committed result before looking at new status.
 select c.actor_id,c.actor_staff_id,c.payload_digest,c.result into v_old
   from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
   if v_old.actor_id is distinct from p_owner or v_old.actor_staff_id is distinct from p_staff or v_old.payload_digest<>v_hash or
      not (v_old.result ? 'work_status') then
     raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
   return v_old.result;
 end if;
 select * into o from public.laundry_pos_orders
   where id=p_order_id and outlet_id=p_outlet and lifecycle_status='CONFIRMED' for update;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='22023';end if;
 if not ((o.work_status='QUEUED' and p_new_status='READY') or
         (o.work_status='READY' and p_new_status='COLLECTED')) then
   raise exception 'POS_WORK_TRANSITION_INVALID' using errcode='22023';end if;
 update public.laundry_pos_orders set work_status=p_new_status,version=version+1 where id=p_order_id;
 v_result:=pg_catalog.jsonb_build_object('order_id',p_order_id,'work_status',p_new_status);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,operation,target_id,payload_digest,result)
 values(p_request_id,p_outlet,p_owner,p_staff,'SET_WORK',p_order_id,v_hash,v_result);
 insert into public.laundry_pos_order_events(order_id,command_id,actor_id,actor_staff_id,kind,data)
 values(p_order_id,p_request_id,p_owner,p_staff,'WORK_STATUS_CHANGED',pg_catalog.jsonb_build_object('from',o.work_status,'to',p_new_status));
 return v_result;
end;
$$;
revoke all on function laundry_private.pos_work_status_core(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;

create or replace function laundry_private.pos_g4_work_status(p_device_token text,p_login_token text,p_request_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'order_work',false) z;
 return laundry_private.pos_work_status_core(null,actor.staff_id,actor.outlet_id,p_request_id,p_order_id,p_new_status);
end; $$;
revoke all on function laundry_private.pos_g4_work_status(text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_work_status(text,text,uuid,uuid,text) to anon,authenticated;

create function laundry_private.pos_owner_work_status(p_request_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();
 outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_work_status_core(owner_id,null,outlet_id,p_request_id,p_order_id,p_new_status);
end; $$;
revoke all on function laundry_private.pos_owner_work_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_work_status(uuid,uuid,text) to authenticated;
create function public.laundry_pos_owner_work_status(p_request_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_work_status(p_request_id,p_order_id,p_new_status); $$;
revoke all on function public.laundry_pos_owner_work_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_work_status(uuid,uuid,text) to authenticated;


-- Owner awards must prove their POS payment command; manual ledger ADD stays gated.
create or replace function laundry_private.pos_guard_legacy_manual_add()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.event_type='ADD' and new.actor_id is not null and exists(
  select 1 from public.laundry_pos_outlets where singleton_key=1 and active and write_enabled and finance_enabled)
 and not exists(
  select 1 from public.laundry_pos_commands c
  join public.laundry_pos_orders o on o.id=c.target_id and o.outlet_id=c.outlet_id
  join public.laundry_pos_payments receipt on receipt.command_id=c.request_id and receipt.order_id=o.id
  where c.request_id=new.request_id and c.operation='PAYMENT' and c.actor_id=new.actor_id
   and c.actor_staff_id is null and o.member_id=new.member_id and o.lifecycle_status='CONFIRMED'
   and receipt.entry_type='RECEIPT' and receipt.confirmed_by=new.actor_id
   and receipt.confirmed_staff_id is null and c.result->>'payment_status'='PAID'
   and (select coalesce(sum(p.amount_idr),0) from public.laundry_pos_payments p
     where p.order_id=o.id and p.entry_type='RECEIPT')=o.total_idr
 ) then raise exception 'POS_LEGACY_MANUAL_AWARD_DISABLED' using errcode='42501';end if;
 return new;
end; $$;
revoke all on function laundry_private.pos_guard_legacy_manual_add() from public,anon,authenticated;

create function laundry_private.pos_cancel_order_core(p_owner uuid,p_staff uuid,p_outlet uuid,
 p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old record; ord record; digest bytea; result jsonb; net_received bigint;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null or p_order_id is null or p_expected_version is null or p_expected_version<1
  or p_reason is null or length(btrim(p_reason)) not between 3 and 300 or p_reason ~ '[[:cntrl:]]'
 then raise exception 'POS_CANCEL_INVALID' using errcode='22023';end if;
 digest:=extensions.digest(jsonb_build_object('operation','CANCEL','order',p_order_id,
  'reason',btrim(p_reason),'version',p_expected_version)::text,'sha256');
 select c.* into old from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
  if old.actor_id is distinct from p_owner or old.actor_staff_id is distinct from p_staff
   or old.outlet_id<>p_outlet or old.operation<>'CANCEL' or old.payload_digest<>digest
  then raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return old.result;
 end if;
 perform 1 from public.laundry_pos_outlets o where o.id=p_outlet and o.active and o.write_enabled for update;
 if not found then raise exception 'POS_WRITES_DISABLED' using errcode='42501';end if;
 select c.* into old from public.laundry_pos_commands c where c.request_id=p_request_id;
 if found then
  if old.actor_id is distinct from p_owner or old.actor_staff_id is distinct from p_staff
   or old.outlet_id<>p_outlet or old.operation<>'CANCEL' or old.payload_digest<>digest
  then raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  return old.result;
 end if;
 select o.* into ord from public.laundry_pos_orders o
  where o.id=p_order_id and o.outlet_id=p_outlet and o.lifecycle_status='CONFIRMED' for update;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='22023';end if;
 if ord.version<>p_expected_version then raise exception 'POS_ORDER_VERSION_CONFLICT' using errcode='22023';end if;
 select coalesce(sum(case when p.entry_type='RECEIPT' then p.amount_idr else -p.amount_idr end),0)
 into net_received from public.laundry_pos_payments p where p.order_id=p_order_id;
 if net_received<>0 then raise exception 'POS_REFUND_REQUIRED' using errcode='22023';end if;
 update public.laundry_pos_orders set lifecycle_status='CANCELLED',version=version+1 where id=p_order_id;
 result:=jsonb_build_object('order_id',p_order_id,'lifecycle_status','CANCELLED','version',ord.version+1);
 insert into public.laundry_pos_commands(request_id,outlet_id,actor_id,actor_staff_id,
  operation,target_id,payload_digest,result)
 values(p_request_id,p_outlet,p_owner,p_staff,'CANCEL',p_order_id,digest,result);
 insert into public.laundry_pos_order_events(order_id,command_id,actor_id,actor_staff_id,kind,reason,data)
 values(p_order_id,p_request_id,p_owner,p_staff,'ORDER_CANCELLED',btrim(p_reason),
  jsonb_build_object('from',ord.lifecycle_status,'to','CANCELLED'));
 return result;
end; $$;
revoke all on function laundry_private.pos_cancel_order_core(uuid,uuid,uuid,uuid,uuid,text,bigint) from public,anon,authenticated;

create function laundry_private.pos_owner_cancel_order(p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_cancel_order_core(owner_id,null,outlet_id,p_request_id,p_order_id,p_reason,p_expected_version);
end; $$;
revoke all on function laundry_private.pos_owner_cancel_order(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_cancel_order(uuid,uuid,text,bigint) to authenticated;
create function public.laundry_pos_owner_cancel_order(p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_owner_cancel_order(p_request_id,p_order_id,p_reason,p_expected_version); $$;
revoke all on function public.laundry_pos_owner_cancel_order(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_cancel_order(uuid,uuid,text,bigint) to authenticated;

create function laundry_private.pos_g4_cancel_order(p_device_token text,p_login_token text,
 p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'order_work',false) z;
 return laundry_private.pos_cancel_order_core(null,actor.staff_id,actor.outlet_id,p_request_id,p_order_id,p_reason,p_expected_version);
end; $$;
revoke all on function laundry_private.pos_g4_cancel_order(text,text,uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_cancel_order(text,text,uuid,uuid,text,bigint) to anon,authenticated;
create function public.laundry_pos_g4_cancel_order(p_device_token text,p_login_token text,
 p_request_id uuid,p_order_id uuid,p_reason text,p_expected_version bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g4_cancel_order(p_device_token,p_login_token,p_request_id,p_order_id,p_reason,p_expected_version); $$;
revoke all on function public.laundry_pos_g4_cancel_order(text,text,uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_cancel_order(text,text,uuid,uuid,text,bigint) to anon,authenticated;

create or replace function laundry_private.pos_owner_capabilities()
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare result jsonb;
begin
 perform laundry_private.pos_owner_required();
 select jsonb_build_object('write_enabled',o.active and o.write_enabled,'duration_support',true,
  'finance_enabled',o.active and o.write_enabled and o.finance_enabled,'owner_operations',true)
 into result from public.laundry_pos_outlets o where o.singleton_key=1;
 return coalesce(result,'{"write_enabled":false,"duration_support":true,"finance_enabled":false,"owner_operations":true}'::jsonb);
end; $$;
revoke all on function laundry_private.pos_owner_capabilities() from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_capabilities() to authenticated;

create function laundry_private.pos_command_result_core(p_owner uuid,p_staff uuid,p_outlet uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare command record;
begin
 if (p_owner is null)=(p_staff is null) then raise exception 'POS_ACTOR_INVALID' using errcode='42501';end if;
 if p_request_id is null then raise exception 'POS_REQUEST_ID_REQUIRED' using errcode='22023';end if;
 select c.operation,c.result into command from public.laundry_pos_commands c
 where c.request_id=p_request_id and c.outlet_id=p_outlet
 and c.actor_id is not distinct from p_owner and c.actor_staff_id is not distinct from p_staff;
 if not found then return jsonb_build_object('found',false);end if;
 return jsonb_build_object('found',true,'operation',command.operation,'result',command.result);
end; $$;
revoke all on function laundry_private.pos_command_result_core(uuid,uuid,uuid,uuid) from public,anon,authenticated;
create function laundry_private.pos_owner_command_result(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_id uuid; outlet_id uuid;
begin
 owner_id:=laundry_private.pos_owner_required();outlet_id:=laundry_private.pos_owner_outlet();
 return laundry_private.pos_command_result_core(owner_id,null,outlet_id,p_request_id);
end; $$;
revoke all on function laundry_private.pos_owner_command_result(uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_command_result(uuid) to authenticated;
create function public.laundry_pos_owner_command_result(p_request_id uuid)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_owner_command_result(p_request_id); $$;
revoke all on function public.laundry_pos_owner_command_result(uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_command_result(uuid) to authenticated;
create function laundry_private.pos_g4_command_result(p_device_token text,p_login_token text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare actor record;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'order_view',false) z;
 return laundry_private.pos_command_result_core(null,actor.staff_id,actor.outlet_id,p_request_id);
end; $$;
revoke all on function laundry_private.pos_g4_command_result(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_command_result(text,text,uuid) to anon,authenticated;
create function public.laundry_pos_g4_command_result(p_device_token text,p_login_token text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_g4_command_result(p_device_token,p_login_token,p_request_id); $$;
revoke all on function public.laundry_pos_g4_command_result(text,text,uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_g4_command_result(text,text,uuid) to anon,authenticated;
