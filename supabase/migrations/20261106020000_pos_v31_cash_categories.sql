-- Additive metadata only: historical journal rows and financial cores are unchanged.
-- Rollback: restore the two public read functions from their private base copies,
-- remove the new entry point, then archive metadata before dropping these tables.
create table laundry_private.pos_v31_cash_categories(
 code text primary key,label text not null,classification text not null check(classification in ('EXPENSE','EQUITY','TRANSFER')));
insert into laundry_private.pos_v31_cash_categories values
 ('DETERGENT','Bahan pencuci','EXPENSE'),('PERFUME','Parfum/pelembut','EXPENSE'),
 ('PACKAGING','Plastik/kemasan','EXPENSE'),('UTILITIES','Utilitas','EXPENSE'),
 ('TRANSPORT','Transportasi','EXPENSE'),('MAINTENANCE','Servis/perawatan','EXPENSE'),
 ('PAYROLL','Gaji/operasional','EXPENSE'),('OTHER','Pengeluaran lainnya','EXPENSE'),
 ('CAPITAL','Modal','EQUITY'),('CASH_TRANSFER','Transfer antar kas','TRANSFER');
create table laundry_private.pos_v31_cash_metadata(
 request_id uuid primary key references public.laundry_pos_commands(request_id),
 category_code text not null references laundry_private.pos_v31_cash_categories(code),
 note text not null check(length(note)<=300 and note !~ '[[:cntrl:]]'));
alter table laundry_private.pos_v31_cash_categories enable row level security;
alter table laundry_private.pos_v31_cash_metadata enable row level security;
revoke all on laundry_private.pos_v31_cash_categories,laundry_private.pos_v31_cash_metadata from public,anon,authenticated;
create trigger pos_v31_cash_metadata_immutable before update or delete on laundry_private.pos_v31_cash_metadata for each row execute function laundry_private.pos_reject_journal_changes();
create trigger pos_v31_cash_categories_immutable before update or delete on laundry_private.pos_v31_cash_categories for each row execute function laundry_private.pos_reject_journal_changes();

create function public.laundry_pos_v31_cash_entry(p_request_id uuid,p_direction text,p_amount_idr text,
 p_category_code text,p_note text default null,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_v uuid;staff_v uuid;outlet_v uuid;category_v record;old_v record;result_v jsonb;note_v text:=btrim(coalesce(p_note,''));
begin
 if p_device_token is null and p_login_token is null then
  owner_v:=laundry_private.pos_owner_required();outlet_v:=laundry_private.pos_owner_outlet();
 else
  select staff_id,outlet_id into staff_v,outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'cash_entry',false);
 end if;
 select * into category_v from laundry_private.pos_v31_cash_categories where code=p_category_code;
 if not found or p_request_id is null or p_direction is null or p_direction not in ('IN','OUT')
  or (category_v.classification='EXPENSE' and p_direction<>'OUT')
  or length(coalesce(p_note,''))>300 or coalesce(p_note,'') ~ '[[:cntrl:]]' then raise exception 'POS_CASH_ENTRY_INVALID' using errcode='22023';end if;
 -- Serialize retries across outlets as well as within the existing outlet lock.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into old_v from laundry_private.pos_v31_cash_metadata where request_id=p_request_id;
 if found then
  if old_v.category_code<>p_category_code or old_v.note<>note_v then raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';end if;
 elsif exists(select 1 from public.laundry_pos_commands where request_id=p_request_id) then
  raise exception 'POS_REQUEST_CONFLICT' using errcode='23505';
 end if;
 -- The unchanged core validates amount, actor, direction, digest and finance gates.
 result_v:=public.laundry_pos_v3_finance('CASH_ENTRY',p_request_id,null,p_amount_idr,null,null,category_v.label,p_direction,p_device_token,p_login_token);
 insert into laundry_private.pos_v31_cash_metadata values(p_request_id,p_category_code,note_v) on conflict(request_id) do nothing;
 return result_v;
end;$$;
revoke all on function public.laundry_pos_v31_cash_entry(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v31_cash_entry(uuid,text,text,text,text,text,text) to anon,authenticated;

create function laundry_private.pos_v31_item_summary(p_order_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('item_count',(select count(*) from public.laundry_pos_order_items where order_id=p_order_id),
 'quantities_milli',coalesce(jsonb_object_agg(unit,quantity),'{}'::jsonb),
 'quantity_summary',string_agg(replace(trim(trailing '.' from trim(trailing '0' from to_char(quantity/1000.0,'FM999999999999990.000'))),'.',',')||' '||unit,' · ' order by case unit when 'kg' then 1 when 'm' then 2 else 3 end))
 from(select unit,sum(quantity_milli) quantity from public.laundry_pos_order_items where order_id=p_order_id group by unit)q;
$$;
revoke all on function laundry_private.pos_v31_item_summary(uuid) from public,anon,authenticated;
create function laundry_private.pos_v31_cash_metadata_json(p_command_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('expense_category_code',c.code,'expense_category_label',c.label,
  'accounting_classification',c.classification,'note',nullif(m.note,''))
  from laundry_private.pos_v31_cash_metadata m join laundry_private.pos_v31_cash_categories c on c.code=m.category_code where m.request_id=p_command_id),
  jsonb_build_object('expense_category_code',null,'expense_category_label',null,'accounting_classification',null));
$$;
revoke all on function laundry_private.pos_v31_cash_metadata_json(uuid) from public,anon,authenticated;

-- Preserve authorization and data scope in the original read functions, then enrich
-- one JSON row per ledger entry. Item aggregation never joins financial amounts.
alter function public.laundry_pos_v3_cash(text,text) set schema laundry_private;
alter function laundry_private.laundry_pos_v3_cash(text,text) rename to pos_v31_cash_base;
revoke all on function laundry_private.pos_v31_cash_base(text,text) from public,anon,authenticated;
create function public.laundry_pos_v3_cash(p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result_v jsonb;entries_v jsonb;outlet_v uuid;
begin
 result_v:=laundry_private.pos_v31_cash_base(p_device_token,p_login_token);
 if p_device_token is null and p_login_token is null then outlet_v:=laundry_private.pos_owner_outlet();
 else select outlet_id into outlet_v from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'cash_view',false);end if;
 select coalesce(jsonb_agg(e.value||jsonb_build_object('id',l.id,'actor',laundry_private.pos_v31_actor_label(l.created_by,l.created_staff_id))
  ||laundry_private.pos_v31_cash_metadata_json(l.command_id)
  ||case when e.value->>'order_id' is not null then laundry_private.pos_v31_item_summary((e.value->>'order_id')::uuid) else '{}'::jsonb end order by e.ordinality),'[]') into entries_v
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

alter function public.laundry_pos_v3_report(timestamptz,timestamptz,text,text) set schema laundry_private;
alter function laundry_private.laundry_pos_v3_report(timestamptz,timestamptz,text,text) rename to pos_v31_report_base;
revoke all on function laundry_private.pos_v31_report_base(timestamptz,timestamptz,text,text) from public,anon,authenticated;
create function public.laundry_pos_v3_report(p_start timestamptz,p_end timestamptz,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result_v jsonb;cash_v jsonb;orders_v jsonb;
begin
 result_v:=laundry_private.pos_v31_report_base(p_start,p_end,p_device_token,p_login_token);
 select coalesce(jsonb_agg(e.value||laundry_private.pos_v31_cash_metadata_json(l.command_id)
  ||jsonb_build_object('actor',laundry_private.pos_v31_actor_label(l.created_by,l.created_staff_id))
  ||case when e.value->>'order_id' is not null then laundry_private.pos_v31_item_summary((e.value->>'order_id')::uuid) else '{}'::jsonb end order by e.ordinality),'[]') into cash_v
 from jsonb_array_elements(result_v->'cash') with ordinality e(value,ordinality)
 join public.laundry_pos_cash_ledger l on l.id=(e.value->>'id')::uuid;
 select coalesce(jsonb_agg(e.value||laundry_private.pos_v31_item_summary(o.id)
  ||jsonb_build_object('creator',laundry_private.pos_v31_actor_label(o.created_by,o.created_staff_id)) order by e.ordinality),'[]') into orders_v
 from jsonb_array_elements(result_v->'orders') with ordinality e(value,ordinality)
 join public.laundry_pos_orders o on o.id=(e.value->>'id')::uuid;
 return result_v||jsonb_build_object('cash',cash_v,'orders',orders_v);
end;$$;
revoke all on function public.laundry_pos_v3_report(timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v3_report(timestamptz,timestamptz,text,text) to anon,authenticated;
