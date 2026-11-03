-- Tighten optimistic input and explicit output fields; expose the actual hand-over actor.
create or replace function public.laundry_pos_save_family(p_id uuid,p_revision bigint,p_input jsonb,p_tariffs jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; v_revision bigint; t jsonb; p record; v_active boolean;
begin
 actor:=laundry_private.pos_owner_required();
 perform 1 from public.laundry_pos_outlets where singleton_key=1 for update;
 perform 1 from public.laundry_catalog_version where singleton for update;
 if p_id is null or p_revision is null or p_revision<0 or p_input is null or jsonb_typeof(p_input)<>'object'
 or coalesce(length(btrim(p_input->>'name')),0) not between 1 and 100
 or coalesce(length(btrim(p_input->>'category')),0) not between 1 and 80
 or p_input->>'unit' not in ('kg','pcs','meter') or p_input->>'unit' is null
 or coalesce(p_input->>'position','') !~ '^[0-9]{1,4}$'
 or jsonb_typeof(p_input->'active') is distinct from 'boolean'
 or (p_input->>'name') ~ '[[:cntrl:]]' or (p_input->>'category') ~ '[[:cntrl:]]'
 or jsonb_typeof(p_tariffs) is distinct from 'array' or jsonb_array_length(p_tariffs)<>3
 then raise exception 'catalog_invalid';end if;
 if (select count(distinct x->>'code') from jsonb_array_elements(p_tariffs) x)<>3 then raise exception 'catalog_invalid';end if;
 select revision into v_revision from public.laundry_pos_service_families where id=p_id;
 if found then
  if v_revision<>p_revision then raise exception 'catalog_conflict';end if;
  update public.laundry_pos_service_families set name=btrim(p_input->>'name'),category=btrim(p_input->>'category'),unit=p_input->>'unit',
  position=(p_input->>'position')::integer,active=(p_input->>'active')::boolean,revision=revision+1 where id=p_id;
 else
  if p_revision<>0 then raise exception 'catalog_conflict';end if;
  if (select count(*) from public.laundry_services)+(select count(*) from jsonb_array_elements(p_tariffs) x where nullif(x->>'existing_id','') is null)>200 then raise exception 'catalog_limit';end if;
  insert into public.laundry_pos_service_families(id,name,category,unit,position,active)
  values(p_id,btrim(p_input->>'name'),btrim(p_input->>'category'),p_input->>'unit',(p_input->>'position')::integer,(p_input->>'active')::boolean);
 end if;
 for t in select value from jsonb_array_elements(p_tariffs) loop
  select * into p from public.laundry_pos_duration_packages where code=t->>'code';
  if not found or jsonb_typeof(t->'active') is distinct from 'boolean'
   or coalesce(t->>'price_idr','') !~ '^(0|[1-9][0-9]{0,9})$' or (t->>'price_idr')::bigint>1000000000
  then raise exception 'catalog_invalid';end if;
  v_active:=(t->>'active')::boolean and (p_input->>'active')::boolean and p.active;
  if nullif(t->>'existing_id','') is not null then
   update public.laundry_services set family_id=p_id,duration_package_code=p.code,name=btrim(p_input->>'name'),category=btrim(p_input->>'category'),unit=p_input->>'unit',
    position=(p_input->>'position')::integer,package_name=p.name,duration=coalesce(p.duration_minutes||' menit','Belum diatur'),duration_minutes=p.duration_minutes
    where id=(t->>'existing_id')::uuid and (family_id is null or (family_id=p_id and duration_package_code=p.code)) and revision=(t->>'existing_revision')::bigint;
   if not found then raise exception 'catalog_conflict';end if;
  end if;
  insert into public.laundry_services(id,family_id,duration_package_code,name,category,unit,position,is_visible,package_available,package_name,duration,duration_minutes,price_idr,updated_by)
  values(gen_random_uuid(),p_id,p.code,btrim(p_input->>'name'),btrim(p_input->>'category'),p_input->>'unit',(p_input->>'position')::integer,
   v_active,(t->>'active')::boolean,p.name,coalesce(p.duration_minutes||' menit','Belum diatur'),p.duration_minutes,(t->>'price_idr')::bigint,actor)
  on conflict(family_id,duration_package_code) do update set name=excluded.name,category=excluded.category,unit=excluded.unit,
   position=excluded.position,is_visible=excluded.is_visible,package_available=excluded.package_available,package_name=excluded.package_name,duration=excluded.duration,
   duration_minutes=excluded.duration_minutes,price_idr=excluded.price_idr,revision=laundry_services.revision+1,updated_by=actor,updated_at=clock_timestamp();
 end loop;
 insert into laundry_private.pos_configuration_events(actor_id,kind,target,revision) values(actor,'FAMILY',p_id::text,p_revision+1);
end; $$;
revoke all on function public.laundry_pos_save_family(uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.laundry_pos_save_family(uuid,bigint,jsonb,jsonb) to authenticated;


create or replace function public.laundry_pos_package_catalog(p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
 if p_device_token is null and p_login_token is null then perform laundry_private.pos_owner_required();
 else perform 1 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false);end if;
 return jsonb_build_object('enabled',(select package_workflow_enabled from public.laundry_pos_outlets where singleton_key=1),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'category',s.category,'package_name',s.package_name,'name',s.name,'price_idr',s.price_idr,'unit',s.unit,'duration',s.duration,'revision',s.revision,'duration_package_code',s.duration_package_code) order by s.position,s.id)
 from public.laundry_services s join public.laundry_pos_duration_packages p on p.code=s.duration_package_code
 join public.laundry_pos_service_families f on f.id=s.family_id where s.is_visible and p.active and f.active),'[]'::jsonb));
end; $$;
revoke all on function public.laundry_pos_package_catalog(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_package_catalog(text,text) to anon,authenticated;


create or replace function public.laundry_pos_whatsapp_receipt(p_order_id uuid,p_kind text,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare owner_id uuid; staff uuid; outlet uuid; o record; paid bigint; refunded bigint; status text;
 year_v integer; balance bigint; awarded integer; projected integer; tier jsonb; member_data jsonb; contact_v jsonb; actor text; collector text;
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
 select coalesce(s.display_name,'Owner '||e.actor_id::text) into collector from public.laundry_pos_order_events e
 left join public.laundry_pos_staff s on s.staff_id=e.actor_staff_id
 where e.order_id=p_order_id and e.kind='WORK_STATUS_CHANGED' and e.data->>'to'='COLLECTED' order by e.occurred_at desc limit 1;
 return jsonb_build_object('invoice',o.invoice_no,'customer',o.customer_name,'actor',actor,'contact',contact_v,
 'collector',collector,'kind',p_kind,'created_at',o.created_at,'due_at',o.due_at,'ready_at',o.ready_at,'collected_at',o.collected_at,'work_status',o.work_status,
 'package',o.package_name_snapshot,'minutes',o.package_minutes_snapshot,'perfume',o.perfume,'notes',o.notes,
 'total',o.total_idr::text,'paid',paid::text,'refunded',refunded::text,'remaining',greatest(0,o.total_idr-paid+refunded)::text,'status',status,'member',member_data,
 'settings',(select jsonb_build_object('revision',s.revision,'config',s.config) from laundry_private.pos_receipt_settings s),
 'items',(select jsonb_agg(jsonb_build_object('name',i.service_name,'package',i.package_snapshot,'duration',i.duration_label,'quantity_milli',i.quantity_milli,
 'unit',i.unit,'price',i.price_idr::text,'subtotal',i.line_total_idr::text) order by i.line_number) from public.laundry_pos_order_items i where i.order_id=p_order_id));
end; $$;
revoke all on function public.laundry_pos_whatsapp_receipt(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_whatsapp_receipt(uuid,text,text,text) to anon,authenticated;
