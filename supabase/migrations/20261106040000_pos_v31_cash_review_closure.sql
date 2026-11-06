-- Function-only closure: no historical journal, note, amount or metadata writes.
-- App rollback retains these authorization/privacy guards and the additive detail RPC.
-- Correct a database regression with a forward migration that preserves those guards.
create or replace function public.laundry_pos_v31_cash_entry(p_request_id uuid,p_direction text,p_amount_idr text,
 p_category_code text,p_note text default null,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_v uuid;staff_v uuid;outlet_v uuid;category_v record;old_v record;result_v jsonb;reason_v text;note_v text:=btrim(coalesce(p_note,''));
begin
 if p_device_token is null and p_login_token is null then
  owner_v:=laundry_private.pos_owner_required();outlet_v:=laundry_private.pos_owner_outlet();
 else
  select staff_id,outlet_id into staff_v,outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'cash_entry',false);
 end if;
 if staff_v is not null and p_category_code in ('CAPITAL','CASH_TRANSFER') then raise exception 'POS_ACCESS_DENIED' using errcode='42501';end if;
 select * into category_v from laundry_private.pos_v31_cash_categories where code=p_category_code;
 if not found or p_request_id is null or p_direction is null or p_direction not in ('IN','OUT')
  or (category_v.classification='EXPENSE' and p_direction<>'OUT')
  or length(coalesce(p_note,''))>300 or coalesce(p_note,'') ~ '[[:cntrl:]]' then raise exception 'POS_CASH_ENTRY_INVALID' using errcode='22023';end if;
 reason_v:=case when p_category_code='CASH_TRANSFER' then 'Perpindahan uang laci (satu sisi)' else category_v.label end;
 -- Serialize retries across outlets as well as within the existing outlet lock.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into old_v from laundry_private.pos_v31_cash_metadata where request_id=p_request_id;
 if found then
  if old_v.category_code<>p_category_code or old_v.note<>note_v then raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  -- Completed retries retain the original financial-core reason and digest, including pre-closure transfers.
  if p_category_code='CASH_TRANSFER' then
   select note into reason_v from public.laundry_pos_cash_ledger where command_id=p_request_id;
   if not found then raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
  end if;
 elsif exists(select 1 from public.laundry_pos_commands where request_id=p_request_id) then
  raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';
 elsif p_category_code='CASH_TRANSFER' and (
  left(note_v,8)<>case p_direction when 'IN' then 'Sumber: ' else 'Tujuan: ' end
  or length(btrim(substring(note_v from 9)))<3) then raise exception 'POS_CASH_ENTRY_INVALID' using errcode='22023';
 end if;
 -- The unchanged core validates amount, actor, direction, digest and finance gates.
 result_v:=public.laundry_pos_v3_finance('CASH_ENTRY',p_request_id,null,p_amount_idr,null,null,reason_v,p_direction,p_device_token,p_login_token);
 insert into laundry_private.pos_v31_cash_metadata values(p_request_id,p_category_code,note_v) on conflict(request_id) do nothing;
 return result_v;
end;$$;
revoke all on function public.laundry_pos_v31_cash_entry(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v31_cash_entry(uuid,text,text,text,text,text,text) to anon,authenticated;

create or replace function laundry_private.pos_v31_cash_metadata_json(p_command_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('expense_category_code',c.code,'expense_category_label',case when c.code='CASH_TRANSFER' then 'Perpindahan uang laci (satu sisi)' else c.label end,
  'accounting_classification',c.classification,'note',nullif(m.note,''))
  from laundry_private.pos_v31_cash_metadata m join laundry_private.pos_v31_cash_categories c on c.code=m.category_code where m.request_id=p_command_id),
  jsonb_build_object('expense_category_code',null,'expense_category_label',null,'accounting_classification',null));
$$;
revoke all on function laundry_private.pos_v31_cash_metadata_json(uuid) from public,anon,authenticated;

create or replace function public.laundry_pos_v3_cash(p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result_v jsonb;entries_v jsonb;outlet_v uuid;
begin
 result_v:=laundry_private.pos_v31_cash_base(p_device_token,p_login_token);
 if p_device_token is null and p_login_token is null then outlet_v:=laundry_private.pos_owner_outlet();
 else select outlet_id into outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'cash_view',false);end if;
 select coalesce(jsonb_agg((e.value-'item_count'-'quantities_milli'-'quantity_summary')||jsonb_build_object('id',l.id,'actor',laundry_private.pos_v31_actor_label(l.created_by,l.created_staff_id))
  ||laundry_private.pos_v31_cash_metadata_json(l.command_id)
  ||case when (e.value->>'can_view_order')::boolean and e.value->>'order_id' is not null then laundry_private.pos_v31_item_summary((e.value->>'order_id')::uuid) else '{}'::jsonb end order by e.ordinality),'[]') into entries_v
 from jsonb_array_elements(result_v->'entries') with ordinality e(value,ordinality)
 join(select id,command_id,created_by,created_staff_id,row_number() over(order by occurred_at desc,id desc) n
  from public.laundry_pos_cash_ledger where outlet_id=outlet_v order by occurred_at desc,id desc limit 80)l on l.n=e.ordinality;
 result_v:=result_v||jsonb_build_object('entries',entries_v);
 select result_v||jsonb_build_object('reconciliations',coalesce(jsonb_agg(e.value||jsonb_build_object('owner',laundry_private.pos_v31_actor_label((e.value->>'owner')::uuid,null)) order by e.ordinality),'[]')) into result_v
 from jsonb_array_elements(result_v->'reconciliations') with ordinality e(value,ordinality);
 return result_v;
end;$$;
revoke all on function public.laundry_pos_v3_cash(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v3_cash(text,text) to anon,authenticated;

-- A single authorized primary-key lookup also serves audit links older than the recent 80 rows.
create function public.laundry_pos_cash_entry_detail(p_entry_id uuid,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare outlet_v uuid;staff_v uuid;can_view boolean:=false;result_v jsonb;
begin
 if p_device_token is null and p_login_token is null then
  perform laundry_private.pos_owner_required();outlet_v:=laundry_private.pos_owner_outlet();can_view:=true;
 else
  select staff_id,outlet_id into staff_v,outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'cash_view',false);
  select coalesce((permissions->>'order_view')::boolean,false) into can_view
   from public.laundry_pos_staff_outlets where staff_id=staff_v and outlet_id=outlet_v;
 end if;
 select jsonb_build_object('id',l.id,'direction',l.direction,'category',l.category,
  'method',coalesce(t.method,l.method),'amount_idr',l.amount_idr::text,'note',l.note,
  'occurred_at',l.occurred_at,'invoice_no',o.invoice_no,'order_id',p.order_id,
  'actor',laundry_private.pos_v31_actor_label(l.created_by,l.created_staff_id),
  'customer',case when can_view then o.customer_name end,'can_view_order',can_view)
  ||laundry_private.pos_v31_cash_metadata_json(l.command_id)
  ||case when can_view and p.order_id is not null then laundry_private.pos_v31_item_summary(p.order_id) else '{}'::jsonb end
 into result_v
 from public.laundry_pos_cash_ledger l
 left join public.laundry_pos_payments p on p.id=l.payment_id
 left join laundry_private.pos_v3_payment_methods t on t.payment_id=coalesce(p.original_receipt_id,p.id)
 left join public.laundry_pos_orders o on o.id=p.order_id and o.outlet_id=outlet_v
 where l.id=p_entry_id and l.outlet_id=outlet_v;
 if result_v is null then raise exception 'POS_CASH_ENTRY_NOT_FOUND' using errcode='P0002';end if;
 return result_v;
end;$$;
revoke all on function public.laundry_pos_cash_entry_detail(uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_cash_entry_detail(uuid,text,text) to anon,authenticated;

