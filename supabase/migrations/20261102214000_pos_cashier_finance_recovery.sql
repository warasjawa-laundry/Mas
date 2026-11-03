-- Read finance availability without granting direct access to outlet flags.
create or replace function laundry_private.pos_g5_financial(p_device_token text,p_login_token text,p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare actor record; finance boolean;
begin
 select z.staff_id,z.outlet_id into actor from laundry_private.pos_g4_cashier_authorize(
  p_device_token,p_login_token,'order_view',false) z;
 select o.active and o.write_enabled and o.finance_enabled into finance from public.laundry_pos_outlets o where o.id=actor.outlet_id;
 return laundry_private.pos_financial_core(null,actor.staff_id,actor.outlet_id,p_order_id)
  ||pg_catalog.jsonb_build_object('finance_enabled',coalesce(finance,false));
end; $$;
revoke all on function laundry_private.pos_g5_financial(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g5_financial(text,text,uuid) to anon,authenticated;

-- Recover only the caller's committed result, with its current operation permission.
create or replace function laundry_private.pos_g4_command_result(p_device_token text,p_login_token text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare actor record; result jsonb; permission text;
begin
 select * into actor from laundry_private.pos_cashier_logged_in(p_device_token,p_login_token);
 if not found then raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 result:=laundry_private.pos_command_result_core(null,actor.staff_id,actor.outlet_id,p_request_id);
 if result->>'found'='true' then
  permission:=case result->>'operation'
   when 'CREATE_ORDER' then 'order_create' when 'PAYMENT' then 'payment_collect'
   when 'FULL_REFUND' then 'refund_full' when 'CASH_ENTRY' then 'cash_entry'
   when 'CLOSE_SHIFT' then 'cash_entry' when 'OPEN_SHIFT' then 'payment_collect'
   when 'SET_WORK' then 'order_work' when 'CANCEL' then 'order_work' end;
  if permission is null or not coalesce((actor.permissions->>permission)::boolean,false) then
   raise exception 'POS_ACCESS_DENIED' using errcode='42501';
  end if;
 end if;
 return result;
end; $$;
revoke all on function laundry_private.pos_g4_command_result(text,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g4_command_result(text,text,uuid) to anon,authenticated;
