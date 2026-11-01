-- G7 cashier: read-only QR and status board; no member/poin writes.
create function laundry_private.pos_g7_resolve_card(p_device_token text,p_login_token text,p_digest_hex text)
returns table(member_number bigint,display_name text)
language plpgsql security definer set search_path='' stable as $$
begin
 perform 1 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'member_lookup',false);
 if p_digest_hex is null or p_digest_hex !~ '^[0-9a-f]{64}$' then return; end if;
 return query select m.member_number,m.display_name
 from public.laundry_member_cards c join public.laundry_members m on m.id=c.member_id
 where c.token_digest=pg_catalog.decode(p_digest_hex,'hex') and c.revoked_at is null and m.is_active limit 1;
end; $$;
revoke all on function laundry_private.pos_g7_resolve_card(text,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g7_resolve_card(text,text,text) to anon,authenticated;
create function public.laundry_pos_g7_resolve_card(p_device_token text,p_login_token text,p_digest_hex text)
returns table(member_number bigint,display_name text)
language sql security invoker set search_path='' stable as $$
 select * from laundry_private.pos_g7_resolve_card(p_device_token,p_login_token,p_digest_hex); $$;
revoke all on function public.laundry_pos_g7_resolve_card(text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g7_resolve_card(text,text,text) to anon,authenticated;
comment on function public.laundry_pos_g7_resolve_card(text,text,text) is
 'Read-only cashier QR: active-card digest matches, member lookup required; no token, receipt, visit or award stored.';

create function laundry_private.pos_g7_order_board(p_device_token text,p_login_token text)
returns table(id uuid,invoice_no text,customer_name text,total_idr bigint,
 work_status text,payment_status text,created_at timestamptz)
language plpgsql security definer set search_path='' stable as $$
declare v_outlet uuid;
begin
 select a.outlet_id into v_outlet from laundry_private.pos_g4_cashier_authorize(
   p_device_token,p_login_token,'order_view',false) a;
 return query
 select o.id,o.invoice_no,o.customer_name,o.total_idr,o.work_status,
  case when o.refund_status='FULLY_REFUNDED' then 'REFUNDED'
       when o.total_idr=0 then 'ZERO_TOTAL'
       when coalesce(x.paid,0)=0 then 'UNPAID'
       when x.paid=o.total_idr then 'PAID' else 'PARTIAL' end::text,
  o.created_at
 from public.laundry_pos_orders o
 left join lateral (select coalesce(sum(p.amount_idr),0) as paid
   from public.laundry_pos_payments p where p.order_id=o.id and p.entry_type='RECEIPT') x on true
 where o.outlet_id=v_outlet and o.lifecycle_status='CONFIRMED'
 order by o.created_at desc,o.id desc limit 80;
end; $$;
revoke all on function laundry_private.pos_g7_order_board(text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g7_order_board(text,text) to anon,authenticated;
create function public.laundry_pos_g7_order_board(p_device_token text,p_login_token text)
returns table(id uuid,invoice_no text,customer_name text,total_idr bigint,
 work_status text,payment_status text,created_at timestamptz)
language sql security invoker set search_path='' stable as $$
 select * from laundry_private.pos_g7_order_board(p_device_token,p_login_token); $$;
revoke all on function public.laundry_pos_g7_order_board(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g7_order_board(text,text) to anon,authenticated;
comment on function public.laundry_pos_g7_order_board(text,text) is
 'Read-only cashier order board with payment status for real Antrian, Siap Ambil, Belum Bayar tabs.';