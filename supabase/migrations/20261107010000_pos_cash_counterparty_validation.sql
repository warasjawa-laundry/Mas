-- Validate new counterparty text separately from the optional note; keep completed retries unchanged.
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
  or length(btrim(split_part(substring(note_v from 9),'|',1)))<3) then raise exception 'POS_CASH_ENTRY_INVALID' using errcode='22023';
 end if;
 -- The unchanged core validates amount, actor, direction, digest and finance gates.
 result_v:=public.laundry_pos_v3_finance('CASH_ENTRY',p_request_id,null,p_amount_idr,null,null,reason_v,p_direction,p_device_token,p_login_token);
 insert into laundry_private.pos_v31_cash_metadata values(p_request_id,p_category_code,note_v) on conflict(request_id) do nothing;
 return result_v;
end;$$;
revoke all on function public.laundry_pos_v31_cash_entry(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v31_cash_entry(uuid,text,text,text,text,text,text) to anon,authenticated;
