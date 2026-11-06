create table laundry_private.pos_order_contact_drafts(
 order_id uuid primary key references public.laundry_pos_orders(id),
 request_id uuid not null unique references public.laundry_pos_commands(request_id),
 phone text check(phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
 address text not null check(length(address)<=240 and address !~ '[[:cntrl:]]'),
 created_at timestamptz not null default clock_timestamp()
);
alter table laundry_private.pos_order_contact_drafts enable row level security;
revoke all on laundry_private.pos_order_contact_drafts from public,anon,authenticated;
create trigger pos_order_contact_drafts_immutable before update or delete on laundry_private.pos_order_contact_drafts
 for each row execute function laundry_private.pos_reject_journal_changes();

create function public.laundry_pos_v31_create_order(p_request_id uuid,p_guest_name text,p_member_number text,p_items jsonb,
 p_perfume text,p_notes text,p_delivery_code text,p_delivery_revision bigint,p_phone text default null,p_address text default '',
 p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result_v jsonb;order_v uuid;already_v boolean;draft_v record;
begin
 if p_request_id is null or (p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$') or p_address is null
  or length(p_address)>240 or p_address ~ '[[:cntrl:]]' then raise exception 'POS_CONTACT_INVALID' using errcode='22023';end if;
 already_v:=exists(select 1 from public.laundry_pos_commands where request_id=p_request_id);
 if p_device_token is null and p_login_token is null then
  result_v:=public.laundry_pos_owner_create_order_with_delivery(p_request_id,p_guest_name,p_member_number,p_items,p_perfume,p_notes,p_delivery_code,p_delivery_revision);
 else
  result_v:=public.laundry_pos_g4_create_order_with_delivery(p_device_token,p_login_token,p_request_id,p_guest_name,p_member_number,p_items,p_perfume,p_notes,p_delivery_code,p_delivery_revision);
 end if;
 order_v:=(result_v->>'order_id')::uuid;
 select * into draft_v from laundry_private.pos_order_contact_drafts where order_id=order_v;
 if found then
  if draft_v.request_id<>p_request_id or draft_v.phone is distinct from p_phone or draft_v.address<>btrim(p_address) then raise exception 'POS_REQUEST_CONFLICT';end if;
 elsif already_v then
  raise exception 'POS_CONTACT_RETRY_CHANGED';
 else
  insert into laundry_private.pos_order_contact_drafts(order_id,request_id,phone,address) values(order_v,p_request_id,p_phone,btrim(p_address));
 end if;
 return result_v;
end;$$;
revoke all on function public.laundry_pos_v31_create_order(uuid,text,text,jsonb,text,text,text,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_v31_create_order(uuid,text,text,jsonb,text,text,text,bigint,text,text,text,text) to anon,authenticated;

-- Used only after the public reader has authorized access to this order.
create function laundry_private.pos_v31_contact_draft(p_order_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('phone',coalesce(d.phone,m.whatsapp_e164),'address',coalesce(d.address,''),'verified_at',null)
 from public.laundry_pos_orders o left join laundry_private.pos_order_contact_drafts d on d.order_id=o.id
 left join public.laundry_members m on m.id=o.member_id where o.id=p_order_id;
$$;
revoke all on function laundry_private.pos_v31_contact_draft(uuid) from public,anon,authenticated;

create or replace function public.laundry_pos_v31_whatsapp_receipt(p_order_id uuid,p_kind text,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare receipt_v jsonb;
begin
 receipt_v:=laundry_private.pos_v31_receipt_snapshot(p_order_id,p_kind,p_device_token,p_login_token,'whatsapp_draft',false);
 return receipt_v||jsonb_build_object('contact_draft',laundry_private.pos_v31_contact_draft(p_order_id));
end;$$;
create or replace function public.laundry_pos_order_audit(p_order_id uuid,p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare receipt_v jsonb;
begin
 receipt_v:=laundry_private.pos_v31_receipt_snapshot(p_order_id,'NEW',p_device_token,p_login_token,'order_view',true);
 return receipt_v||jsonb_build_object('contact_draft',laundry_private.pos_v31_contact_draft(p_order_id));
end;$$;
