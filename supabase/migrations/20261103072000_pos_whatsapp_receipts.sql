create table laundry_private.pos_receipt_settings (
 singleton boolean primary key default true check(singleton), revision bigint not null default 1,
 config jsonb not null
);
insert into laundry_private.pos_receipt_settings(config) values(jsonb_build_object(
 'outlet_name','MAS JAWA LAUNDRY KRAKSAAN',
 'address','Jl Kandang Jati Kulon Rt06 RW 01 DEPAN MASJID AL HIDAYAH',
 'contact','082313359989',
 'new_title','', 'ready_title','PEMBERITAHUAN CUCIAN SIAP DIAMBIL', 'collected_title','KONFIRMASI PENGAMBILAN PESANAN',
 'terms',E'1. Pengaduan Komplain max 1x24 jam.\n2. Kerusakan luntur, susut dan berkerut akibat proses pencucian bukan tanggung jawab kami.\n3. Jumlah pakaian yang tidak dihitung oleh pelanggan bukan tanggung jawab kami dan hitungan kami yang di anggap benar.\n4. Kami tidak bertanggung jawab apabila terjadi keadaan memaksa/Force Majeur (Banjir,Kebakaran,Gempa Bumi,dan Huru Hara).',
 'payment_notice',E'Pelanggan MASJAWA LAUNDRY yg terhormat.\nPEMBERITAHUAN\nDemi kenyamanan bersama dan kelancaran aktivitas operasional, WAJIB MELAKUKAN PEMBAYARAN DI AWAL (CASH/LUNAS) saat menitipkan pakaian.\nTerima kasih atas pengertiannya.',
 'bank',E'MANDIRI\n1430034007094\n(SYAIFUL ANWAR WIJAYA)',
 'ewallet',E'DANA / LINK AJA/SHOPEE\n082301293749',
 'cs',E'Untuk keluhan dan informasi\ncs0821-2935-5758'));
create table laundry_private.pos_receipt_setting_versions (
 revision bigint primary key, config jsonb not null, actor_id uuid not null references auth.users(id),
 occurred_at timestamptz not null default clock_timestamp()
);
create index pos_receipt_setting_actor_idx on laundry_private.pos_receipt_setting_versions(actor_id);
create table laundry_private.pos_order_contacts (
 id bigint generated always as identity primary key, request_id uuid not null unique,
 order_id uuid not null references public.laundry_pos_orders(id),
 actor_id uuid references auth.users(id), actor_staff_id uuid references public.laundry_pos_staff(staff_id),
 phone text check(phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
 address text check(length(address)<=240 and address !~ '[[:cntrl:]]'),
 verified_at timestamptz not null default clock_timestamp(),
 check((actor_id is null)<>(actor_staff_id is null))
);
create index pos_order_contact_lookup_idx on laundry_private.pos_order_contacts(order_id,id desc);
create index pos_order_contact_owner_idx on laundry_private.pos_order_contacts(actor_id);
create index pos_order_contact_staff_idx on laundry_private.pos_order_contacts(actor_staff_id);
alter table laundry_private.pos_receipt_settings enable row level security;
alter table laundry_private.pos_receipt_setting_versions enable row level security;
alter table laundry_private.pos_order_contacts enable row level security;
revoke all on laundry_private.pos_receipt_settings,laundry_private.pos_receipt_setting_versions,laundry_private.pos_order_contacts from public,anon,authenticated;
create trigger pos_receipt_versions_immutable before update or delete on laundry_private.pos_receipt_setting_versions
 for each row execute function laundry_private.pos_reject_journal_changes();
create trigger pos_contacts_immutable before update or delete on laundry_private.pos_order_contacts
 for each row execute function laundry_private.pos_reject_journal_changes();

create function public.laundry_pos_receipt_settings() returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
 perform laundry_private.pos_owner_required();
 return (select to_jsonb(s)-'singleton' from laundry_private.pos_receipt_settings s);
end; $$;
revoke all on function public.laundry_pos_receipt_settings() from public,anon,authenticated;
grant execute on function public.laundry_pos_receipt_settings() to authenticated;
create function public.laundry_pos_save_receipt_settings(p_revision bigint,p_config jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; entry record; old_config jsonb;
begin
 actor:=laundry_private.pos_owner_required();
 select config into old_config from laundry_private.pos_receipt_settings where singleton and revision=p_revision for update;
 if not found then raise exception 'template_conflict';end if;
 if jsonb_typeof(p_config) is distinct from 'object' or (select array_agg(key order by key) from jsonb_each(p_config))
 is distinct from (select array_agg(key order by key) from jsonb_each(old_config)) then raise exception 'template_invalid';end if;
 for entry in select * from jsonb_each(p_config) loop
  if jsonb_typeof(entry.value)<>'string' or length(entry.value#>>'{}')>4000
   or (entry.value#>>'{}') ~ E'[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]' then raise exception 'template_invalid';end if;
 end loop;
 if length(btrim(p_config->>'outlet_name'))<2 or length(btrim(p_config->>'cs'))<3 then raise exception 'template_invalid';end if;
 insert into laundry_private.pos_receipt_setting_versions(revision,config,actor_id) values(p_revision,old_config,actor) on conflict do nothing;
 update laundry_private.pos_receipt_settings set config=p_config,revision=revision+1 where singleton;
end; $$;
revoke all on function public.laundry_pos_save_receipt_settings(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.laundry_pos_save_receipt_settings(bigint,jsonb) to authenticated;

create function public.laundry_pos_verify_order_contact(p_order_id uuid,p_request_id uuid,p_phone text,p_address text,p_confirmed boolean,
 p_device_token text default null,p_login_token text default null) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; staff uuid; outlet uuid; old_contact record;
begin
 if p_device_token is null and p_login_token is null then owner_id:=laundry_private.pos_owner_required();outlet:=laundry_private.pos_owner_outlet();
 else select z.staff_id,z.outlet_id into staff,outlet from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'whatsapp_draft',false) z;end if;
 if p_request_id is null or p_confirmed is distinct from true or (p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$')
 or p_address is null or length(p_address)>240 or p_address ~ '[[:cntrl:]]' then raise exception 'contact_invalid';end if;
 perform 1 from public.laundry_pos_orders where id=p_order_id and outlet_id=outlet for update;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='42501';end if;
 select * into old_contact from laundry_private.pos_order_contacts where request_id=p_request_id;
 if found then
  if old_contact.order_id<>p_order_id or old_contact.actor_id is distinct from owner_id or old_contact.actor_staff_id is distinct from staff
  or old_contact.phone is distinct from p_phone or old_contact.address<>p_address then raise exception 'contact_request_conflict';end if;
  return;
 end if;
 insert into laundry_private.pos_order_contacts(request_id,order_id,actor_id,actor_staff_id,phone,address)
 values(p_request_id,p_order_id,owner_id,staff,p_phone,p_address);
end; $$;
revoke all on function public.laundry_pos_verify_order_contact(uuid,uuid,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_verify_order_contact(uuid,uuid,text,text,boolean,text,text) to anon,authenticated;

-- A fresh statement reads payments, configuration and the existing point ledger
-- together. It creates neither a payment nor points nor a delivery receipt.
create function public.laundry_pos_whatsapp_receipt(p_order_id uuid,p_kind text,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_id uuid; staff uuid; outlet uuid; o record; paid bigint; refunded bigint; status text;
 year_v integer; balance bigint; awarded integer; projected integer; tier jsonb; member_data jsonb; contact_v jsonb; actor text;
begin
 if p_device_token is null and p_login_token is null then owner_id:=laundry_private.pos_owner_required();outlet:=laundry_private.pos_owner_outlet();
 else select z.staff_id,z.outlet_id into staff,outlet from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'whatsapp_draft',false) z;end if;
 select * into o from public.laundry_pos_orders where id=p_order_id and outlet_id=outlet;
 if not found then raise exception 'POS_ORDER_NOT_FOUND' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('NEW','READY','COLLECTED') or o.lifecycle_status<>'CONFIRMED'
 or (p_kind='READY' and o.work_status<>'READY') or (p_kind='COLLECTED' and o.work_status<>'COLLECTED') then raise exception 'receipt_status_invalid';end if;
 select coalesce(sum(amount_idr) filter(where entry_type='RECEIPT'),0),coalesce(sum(amount_idr) filter(where entry_type='REFUND'),0)
 into paid,refunded from public.laundry_pos_payments where order_id=p_order_id;
 status:=case when refunded>0 or o.refund_status<>'NONE' then 'REFUNDED' when o.total_idr=0 then 'ZERO_TOTAL'
 when paid=0 then 'UNPAID' when paid=o.total_idr then 'PAID' else 'PARTIAL' end;
 if p_kind='COLLECTED' and status<>'PAID' then raise exception 'receipt_status_invalid';end if;
 if o.member_id is not null then
  select p.program_year,p.awarded_points into year_v,awarded from public.laundry_pos_point_links p where p.order_id=p_order_id and p.link_type='ADD';
  year_v:=coalesce(year_v,extract(year from timezone('Asia/Jakarta',statement_timestamp()))::integer);
  select coalesce(sum(t.awarded_points),0) into balance from public.laundry_amount_transactions t where t.member_id=o.member_id and t.program_year=year_v
   and not exists(select 1 from public.laundry_checklist_events e where e.event_type='VOID' and e.reverses_event_id=t.visit_event_id);
  if status in ('UNPAID','PARTIAL') then
   for tier in select value from public.laundry_point_rules r cross join lateral jsonb_array_elements(r.tiers) where r.program_year=year_v order by (value->>'minimum')::bigint loop
    projected:=coalesce(projected,0);if o.total_idr >= (tier->>'minimum')::bigint then projected:=(tier->>'points')::integer;end if;
   end loop;
  end if;
  member_data:=jsonb_build_object('year',year_v,'balance',balance::text,'awarded',case when status='PAID' then coalesce(awarded,0) else 0 end,'projected',projected);
 end if;
 select jsonb_build_object('phone',c.phone,'address',c.address,'verified_at',c.verified_at) into contact_v
 from laundry_private.pos_order_contacts c where c.order_id=p_order_id order by c.id desc limit 1;
 select s.display_name into actor from public.laundry_pos_staff s where s.staff_id=o.created_staff_id;
 actor:=coalesce(actor,'Owner '||o.created_by::text);
 return jsonb_build_object('invoice',o.invoice_no,'customer',o.customer_name,'actor',actor,'contact',contact_v,
 'kind',p_kind,'created_at',o.created_at,'due_at',o.due_at,'ready_at',o.ready_at,'collected_at',o.collected_at,'work_status',o.work_status,
 'package',o.package_name_snapshot,'minutes',o.package_minutes_snapshot,'perfume',o.perfume,'notes',o.notes,
 'total',o.total_idr::text,'paid',paid::text,'refunded',refunded::text,'remaining',greatest(0,o.total_idr-paid+refunded)::text,'status',status,'member',member_data,
 'settings',(select jsonb_build_object('revision',s.revision,'config',s.config) from laundry_private.pos_receipt_settings s),
 'items',(select jsonb_agg(jsonb_build_object('name',i.service_name,'package',i.package_snapshot,'duration',i.duration_label,'quantity_milli',i.quantity_milli,
 'unit',i.unit,'price',i.price_idr::text,'subtotal',i.line_total_idr::text) order by i.line_number) from public.laundry_pos_order_items i where i.order_id=p_order_id));
end; $$;
revoke all on function public.laundry_pos_whatsapp_receipt(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_whatsapp_receipt(uuid,text,text,text) to anon,authenticated;
