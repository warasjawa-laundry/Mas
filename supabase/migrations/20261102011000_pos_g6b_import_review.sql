-- G6b: owner-only historical Binatu Excel preview, isolated from money/point ledgers.
-- Full file contents never stored. Only selected, bounded review fields are stored.
-- All imports are NON-POSTING, even when a payment is marked PAID.

alter table public.laundry_pos_import_rows
 add column source_customer text check (source_customer is null or length(source_customer) between 1 and 120),
 add column source_total_idr bigint check (source_total_idr is null or source_total_idr between 0 and 1000000000),
 add column source_paid_idr bigint check (source_paid_idr is null or source_paid_idr between 0 and 1000000000),
 add column review_reason text check (review_reason is null or length(review_reason) between 3 and 300),
 add column reviewed_by uuid references public.laundry_owner_accounts(auth_user_id),
 add column reviewed_at timestamptz;
create index pos_import_rows_invoice_idx on public.laundry_pos_import_rows(external_invoice);
create index pos_import_rows_match_idx on public.laundry_pos_import_rows(match_member_id,review_status);

-- No cascade into POS orders, payments, amount ledger, member award/VOID.
create function laundry_private.pos_g6b_import_preview(
 p_source text,p_sha_hex text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_outlet uuid; v_batch uuid; v_item record;
 v_no text;v_name text;v_payment text;v_status text;v_total bigint;v_paid bigint;
 v_row integer;v_review text;v_existing uuid;v_count integer:=0;v_existing_count integer;
begin
 v_owner:=laundry_private.pos_owner_required();
 if p_source<>'BINATU' or p_sha_hex is null or p_sha_hex !~ '^[0-9a-f]{64}$' or
  p_rows is null or jsonb_typeof(p_rows)<>'array' or
  jsonb_array_length(p_rows) not between 1 and 200 then
   raise exception 'POS_IMPORT_INVALID' using errcode='22023';end if;
 select id into strict v_outlet from public.laundry_pos_outlets where singleton_key=1;
 -- Serialize by file digest, retaining immutable first import and review decisions.
 select id into v_existing from public.laundry_pos_import_batches
 where outlet_id=v_outlet and source_system=p_source and file_sha256=decode(p_sha_hex,'hex');
 if found then
   return jsonb_build_object('batch_id',v_existing,'duplicate_file',true,
      'rows',(select count(*) from public.laundry_pos_import_rows where batch_id=v_existing));
 end if;
 insert into public.laundry_pos_import_batches(outlet_id,source_system,file_sha256,imported_by,status)
 values(v_outlet,p_source,decode(p_sha_hex,'hex'),v_owner,'PREVIEW') returning id into v_batch;
 for v_item in select value as item from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_item.item)<>'object' or
   (select count(*) from jsonb_object_keys(v_item.item))<>7 or
   not (v_item.item ?& array['row','invoice','customer','payment','status','total','paid']) then
    raise exception 'POS_IMPORT_ROW_FIELDS' using errcode='22023';end if;
  if (v_item.item->>'row') !~ '^[1-9][0-9]{0,4}$' or
     (v_item.item->>'total') !~ '^(0|[1-9][0-9]{0,9})$' or
     (v_item.item->>'paid') !~ '^(0|[1-9][0-9]{0,9})$' then
    raise exception 'POS_IMPORT_ROW_FORMAT' using errcode='22023';end if;
  v_row:=(v_item.item->>'row')::integer;
  v_no:=btrim(v_item.item->>'invoice');v_name:=btrim(v_item.item->>'customer');
  v_payment:=v_item.item->>'payment';v_status:=v_item.item->>'status';
  v_total:=(v_item.item->>'total')::bigint;v_paid:=(v_item.item->>'paid')::bigint;
  if length(v_no) not between 1 and 100 or length(v_name) not between 2 and 120 or
    v_no ~ '[[:cntrl:]]' or v_name ~ '[[:cntrl:]]' or
    v_payment not in ('PAID','PARTIAL','UNPAID','UNKNOWN') or
    v_status not in ('ANTRIAN','SIAP_AMBIL','SELESAI','LAINNYA') or
    v_total>1000000000 or v_paid>v_total then
    raise exception 'POS_IMPORT_ROW_VALUE' using errcode='22023';end if;
  if v_payment='PAID' and v_paid<>v_total then
     raise exception 'POS_IMPORT_INCONSISTENT_PAID' using errcode='22023';end if;
  if v_payment='UNPAID' and v_paid<>0 then
     raise exception 'POS_IMPORT_INCONSISTENT_UNPAID' using errcode='22023';end if;
  v_review:='PENDING';
  select count(*) into v_existing_count from public.laundry_pos_import_rows ir
   join public.laundry_pos_import_batches ib on ib.id=ir.batch_id
   where ib.outlet_id=v_outlet and ib.source_system=p_source and ir.external_invoice=v_no;
  if v_existing_count>0 or exists(select 1 from public.laundry_pos_orders o
     where o.outlet_id=v_outlet and o.invoice_no=v_no) then v_review:='CONFLICT';end if;
  insert into public.laundry_pos_import_rows(batch_id,row_number,row_sha256,external_invoice,
     parsed_status,source_customer,source_total_idr,source_paid_idr,review_status,raw_snapshot)
  values(v_batch,v_row,extensions.digest(v_item.item::text,'sha256'),v_no,v_payment,
    v_name,v_total,v_paid,v_review,jsonb_build_object('status',v_status));
  v_count:=v_count+1;
 end loop;
 return jsonb_build_object('batch_id',v_batch,'duplicate_file',false,'rows',v_count);
end; $$;
revoke all on function laundry_private.pos_g6b_import_preview(text,text,jsonb) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6b_import_preview(text,text,jsonb) to authenticated;
create function public.laundry_pos_g6b_import_preview(p_source text,p_sha_hex text,p_rows jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g6b_import_preview(p_source,p_sha_hex,p_rows); $$;
revoke all on function public.laundry_pos_g6b_import_preview(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.laundry_pos_g6b_import_preview(text,text,jsonb) to authenticated;

create function laundry_private.pos_g6b_import_batches()
returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
 perform laundry_private.pos_owner_required();
 return coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'source',b.source_system,
    'received_at',b.received_at,'status',b.status,
    'total_rows',(select count(*) from public.laundry_pos_import_rows r where r.batch_id=b.id),
    'pending_paid',(select count(*) from public.laundry_pos_import_rows r where r.batch_id=b.id
       and r.parsed_status='PAID' and r.review_status in ('PENDING','CONFLICT')))
    order by b.received_at desc,b.id desc)
  from (select * from public.laundry_pos_import_batches order by received_at desc,id desc limit 15) b),'[]'::jsonb);
end; $$;
revoke all on function laundry_private.pos_g6b_import_batches() from public,anon,authenticated;
grant execute on function laundry_private.pos_g6b_import_batches() to authenticated;
create function public.laundry_pos_g6b_import_batches()
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_g6b_import_batches(); $$;
revoke all on function public.laundry_pos_g6b_import_batches() from public,anon,authenticated;
grant execute on function public.laundry_pos_g6b_import_batches() to authenticated;

create function laundry_private.pos_g6b_import_rows(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
 perform laundry_private.pos_owner_required();
 if not exists(select 1 from public.laundry_pos_import_batches where id=p_batch_id) then
  raise exception 'POS_IMPORT_NOT_FOUND' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'row',r.row_number,
  'invoice',r.external_invoice,'customer',r.source_customer,'status',r.raw_snapshot->>'status',
  'payment',r.parsed_status,'total_idr',r.source_total_idr::text,
  'paid_idr',r.source_paid_idr::text,'review',r.review_status,
  'member_id',r.match_member_id,'reason',r.review_reason)
  order by r.row_number) from public.laundry_pos_import_rows r where r.batch_id=p_batch_id),'[]'::jsonb);
end; $$;
revoke all on function laundry_private.pos_g6b_import_rows(uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6b_import_rows(uuid) to authenticated;
create function public.laundry_pos_g6b_import_rows(p_batch_id uuid)
returns jsonb language sql security invoker set search_path='' stable as $$
 select laundry_private.pos_g6b_import_rows(p_batch_id); $$;
revoke all on function public.laundry_pos_g6b_import_rows(uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_g6b_import_rows(uuid) to authenticated;

-- Owner-only candidate details: exact (casefolded) name and at most 12 results;
-- phone/address are never sent to cashier RPCs or written back to snapshot.
create function laundry_private.pos_g6b_member_candidates(p_row_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare r record;
begin
 perform laundry_private.pos_owner_required();
 select source_customer into r from public.laundry_pos_import_rows where id=p_row_id;
 if not found then raise exception 'POS_IMPORT_ROW_NOT_FOUND' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'number',m.member_number::text,
  'name',m.display_name,'phone',m.whatsapp_e164,'address',m.address) order by m.member_number)
 from (select * from public.laundry_members m where m.is_active and
  lower(btrim(m.display_name))=lower(btrim(r.source_customer))
  order by m.member_number limit 12) m),'[]'::jsonb);
end; $$;
revoke all on function laundry_private.pos_g6b_member_candidates(uuid) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6b_member_candidates(uuid) to authenticated;
create function public.laundry_pos_g6b_member_candidates(p_row_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g6b_member_candidates(p_row_id); $$;
revoke all on function public.laundry_pos_g6b_member_candidates(uuid) from public,anon,authenticated;
grant execute on function public.laundry_pos_g6b_member_candidates(uuid) to authenticated;

-- Immutable paid source interpretation, with only owner review status changing.
-- Verified import row is STILL HISTORICAL, not a sale, point event, or receipt.
create function laundry_private.pos_g6b_review_row(
 p_row_id uuid,p_member_id uuid,p_decision text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid; r record;v_reason text:=btrim(coalesce(p_reason,''));v_name text;
begin
 v_owner:=laundry_private.pos_owner_required();
 if p_row_id is null or p_decision not in ('MATCHED','SKIPPED','CONFLICT') or
  length(v_reason)>300 or v_reason~'[[:cntrl:]]' then
   raise exception 'POS_REVIEW_INVALID' using errcode='22023';end if;
 -- Serialize review of a shared legacy invoice across rows/batches.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  (select external_invoice from public.laundry_pos_import_rows where id=p_row_id), 0));
 select * into r from public.laundry_pos_import_rows where id=p_row_id for update;
 if not found or r.parsed_status<>'PAID' then raise exception 'POS_REVIEW_NOT_PAID' using errcode='22023';end if;
 if r.review_status='MATCHED' and (p_decision<>'MATCHED' or p_member_id is distinct from r.match_member_id) then
   raise exception 'POS_REVIEW_ALREADY_CONFIRMED' using errcode='23505';end if;
 if p_decision='MATCHED' then
   if p_member_id is null then raise exception 'POS_REVIEW_MEMBER_REQUIRED' using errcode='22023';end if;
   select display_name into v_name from public.laundry_members where id=p_member_id and is_active;
   if not found or lower(btrim(v_name))<>lower(btrim(r.source_customer)) then
     raise exception 'POS_REVIEW_IDENTITY_MISMATCH' using errcode='22023';end if;
   if exists(select 1 from public.laundry_pos_import_rows x
      join public.laundry_pos_import_batches b on b.id=x.batch_id
      join public.laundry_pos_import_batches own on own.id=r.batch_id
      where b.outlet_id=own.outlet_id and b.source_system=own.source_system and
      x.external_invoice=r.external_invoice and x.id<>r.id and x.review_status='MATCHED') then
      raise exception 'POS_REVIEW_DUPLICATE_INVOICE' using errcode='23505';end if;
   if exists(select 1 from public.laundry_pos_orders o where o.invoice_no=r.external_invoice) then
      raise exception 'POS_REVIEW_POS_INVOICE_CONFLICT' using errcode='23505';end if;
 else
   if length(v_reason)<3 then raise exception 'POS_REVIEW_REASON_REQUIRED' using errcode='22023';end if;
   p_member_id:=null;
 end if;
 update public.laundry_pos_import_rows set review_status=p_decision,match_member_id=p_member_id,
  review_reason=nullif(v_reason,''),reviewed_by=v_owner,reviewed_at=clock_timestamp()
 where id=p_row_id;
 return jsonb_build_object('row_id',p_row_id,'status',p_decision,
  'member_id',p_member_id,'financial_posted',false,'points_awarded',0);
end; $$;
revoke all on function laundry_private.pos_g6b_review_row(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_g6b_review_row(uuid,uuid,text,text) to authenticated;
create function public.laundry_pos_g6b_review_row(
 p_row_id uuid,p_member_id uuid,p_decision text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
 select laundry_private.pos_g6b_review_row(p_row_id,p_member_id,p_decision,p_reason); $$;
revoke all on function public.laundry_pos_g6b_review_row(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_g6b_review_row(uuid,uuid,text,text) to authenticated;