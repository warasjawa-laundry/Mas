-- A rolled-back DB test of the authoritative test-only guard; no fake rows persist.
begin;
do $$
declare v_outlet uuid; v_message text;
begin
 if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='laundry_pos_orders'
    and column_name='is_test_order') then raise exception 'PILOT_SCHEMA_MISSING';end if;
 if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='laundry_pos_outlets'
    and column_name='pilot_test_only') then raise exception 'PILOT_SWITCH_MISSING';end if;
 select id into v_outlet from public.laundry_pos_outlets where singleton_key=1;
 if v_outlet is null then raise exception 'PILOT_OUTLET_MISSING';end if;
 update public.laundry_pos_outlets set pilot_test_only=true where id=v_outlet;
 begin
  insert into public.laundry_pos_orders(
    outlet_id,sequence_number,invoice_no,member_id,customer_name,
    service_subtotal_idr,total_idr,catalog_revision)
  values(v_outlet,999999901,'MJL-TEST-REJECT-1',gen_random_uuid(),
     'UJI - Member Asli',1000,1000,1);
  raise exception 'UNSAFE_MEMBER_ACCEPTED';
 exception when others then
  get stacked diagnostics v_message=message_text;
  if v_message<>'POS_PILOT_GUEST_ONLY' then
   raise exception 'MEMBER_GUARD_FAILED: %',v_message;end if;
 end;
 begin
  insert into public.laundry_pos_orders(
    outlet_id,sequence_number,invoice_no,customer_name,
    service_subtotal_idr,total_idr,catalog_revision)
  values(v_outlet,999999902,'MJL-TEST-REJECT-2',
     'Pelanggan sungguhan',1000,1000,1);
  raise exception 'UNSAFE_GUEST_ACCEPTED';
 exception when others then
  get stacked diagnostics v_message=message_text;
  if v_message<>'POS_PILOT_GUEST_ONLY' then
   raise exception 'NAME_GUARD_FAILED: %',v_message;end if;
 end;
end $$;
rollback;
