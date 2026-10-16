-- Stage 5: owner-authorized QR resolution and append-only transaction checklist.
-- Never increase visits on QR scan. A separately confirmed owner action calls record.
-- Private security-definer routines remain outside the Supabase exposed API schema.

create or replace function laundry_private.resolve_owner_card(p_digest_hex text)
returns table(member_id uuid, member_number bigint, display_name text)
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null or not exists (
   select 1 from public.laundry_owner_accounts o
   where o.auth_user_id=auth.uid() and o.is_active
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_digest_hex is null or p_digest_hex !~ '^[a-f0-9]{64}$' then return; end if;
 return query
 select m.id,m.member_number,m.display_name
 from public.laundry_member_cards c
 join public.laundry_members m on m.id=c.member_id
 where c.token_digest=decode(p_digest_hex,'hex')
   and c.revoked_at is null and m.is_active
 limit 1;
end;
$$;
revoke all on function laundry_private.resolve_owner_card(text) from public,anon,authenticated;
grant execute on function laundry_private.resolve_owner_card(text) to authenticated;

create or replace function public.laundry_resolve_owner_card(p_digest_hex text)
returns table(member_id uuid, member_number bigint, display_name text)
language sql security invoker set search_path=''
as $$ select * from laundry_private.resolve_owner_card(p_digest_hex); $$;
revoke all on function public.laundry_resolve_owner_card(text) from public,anon,authenticated;
grant execute on function public.laundry_resolve_owner_card(text) to authenticated;

create or replace function laundry_private.record_visit(p_member_id uuid,p_request_id uuid)
returns table(event_id uuid,current_total bigint)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_event uuid;
begin
 if v_actor is null or not exists (
   select 1 from public.laundry_owner_accounts o
   where o.auth_user_id=v_actor and o.is_active
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_member_id is null or p_request_id is null then
   raise exception 'invalid_request' using errcode='22023'; end if;
 if not exists (select 1 from public.laundry_members m
                where m.id=p_member_id and m.is_active) then
   raise exception 'member_not_active' using errcode='22023'; end if;

 insert into public.laundry_checklist_events (member_id,event_type,request_id,actor_id)
 values (p_member_id,'ADD',p_request_id,v_actor)
 on conflict(request_id) do nothing
 returning id into v_event;

 if v_event is null then
   select e.id into v_event from public.laundry_checklist_events e
   where e.request_id=p_request_id and e.member_id=p_member_id
     and e.actor_id=v_actor and e.event_type='ADD';
   if v_event is null then
     raise exception 'idempotency_key_conflict' using errcode='23505';
   end if;
 end if;

 return query select v_event,
   (select count(*)::bigint from public.laundry_checklist_events added
    where added.member_id=p_member_id and added.event_type='ADD'
      and not exists (
        select 1 from public.laundry_checklist_events corrected
        where corrected.reverses_event_id=added.id and corrected.event_type='VOID'
      ));
end;
$$;
revoke all on function laundry_private.record_visit(uuid,uuid) from public,anon,authenticated;
grant execute on function laundry_private.record_visit(uuid,uuid) to authenticated;

create or replace function public.laundry_record_visit(p_member_id uuid,p_request_id uuid)
returns table(event_id uuid,current_total bigint)
language sql security invoker set search_path=''
as $$ select * from laundry_private.record_visit(p_member_id,p_request_id); $$;
revoke all on function public.laundry_record_visit(uuid,uuid) from public,anon,authenticated;
grant execute on function public.laundry_record_visit(uuid,uuid) to authenticated;

-- Owners may correct a mistaken +1 by appending a VOID record with a reason.
-- A VOID cannot change the earlier immutable ADD history.
create or replace function laundry_private.void_visit(p_event_id uuid,p_reason text,p_request_id uuid)
returns table(event_id uuid,member_id uuid,current_total bigint)
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_original record; v_void uuid; v_note text:=btrim(coalesce(p_reason,''));
begin
 if v_actor is null or not exists (
   select 1 from public.laundry_owner_accounts o
   where o.auth_user_id=v_actor and o.is_active
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_event_id is null or p_request_id is null or length(v_note) not between 3 and 500
 then raise exception 'invalid_request' using errcode='22023'; end if;

 select e.id,e.member_id,e.event_type into v_original
 from public.laundry_checklist_events e
 where e.id=p_event_id;
 if not found or v_original.event_type <> 'ADD' then
   raise exception 'visit_not_found' using errcode='22023'; end if;

 insert into public.laundry_checklist_events
  (member_id,event_type,reverses_event_id,reason,request_id,actor_id)
 values (v_original.member_id,'VOID',p_event_id,v_note,p_request_id,v_actor)
 on conflict(request_id) do nothing
 returning id into v_void;
 if v_void is null then
   select e.id into v_void from public.laundry_checklist_events e
   where e.request_id=p_request_id and e.member_id=v_original.member_id
     and e.actor_id=v_actor and e.reverses_event_id=p_event_id
     and e.event_type='VOID' and e.reason=v_note;
   if v_void is null then raise exception 'idempotency_key_conflict' using errcode='23505'; end if;
 end if;

 return query select v_void,v_original.member_id,
   (select count(*)::bigint from public.laundry_checklist_events added
    where added.member_id=v_original.member_id and added.event_type='ADD'
      and not exists (select 1 from public.laundry_checklist_events corrected
                      where corrected.reverses_event_id=added.id and corrected.event_type='VOID'));
end;
$$;
revoke all on function laundry_private.void_visit(uuid,text,uuid) from public,anon,authenticated;
grant execute on function laundry_private.void_visit(uuid,text,uuid) to authenticated;
create or replace function public.laundry_void_visit(p_event_id uuid,p_reason text,p_request_id uuid)
returns table(event_id uuid,member_id uuid,current_total bigint)
language sql security invoker set search_path=''
as $$ select * from laundry_private.void_visit(p_event_id,p_reason,p_request_id); $$;
revoke all on function public.laundry_void_visit(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.laundry_void_visit(uuid,text,uuid) to authenticated;

comment on function public.laundry_record_visit(uuid,uuid) is
 'Only explicit owner confirmation creates a visit; QR scan is read-only. Retry-safe request UUID.';
comment on function public.laundry_void_visit(uuid,text,uuid) is
 'Correction is an append-only VOID event with reason and audit trail, never deleting an ADD.';
