-- Stage 6 manual member promotions.
-- Only the explicitly allowed active owner may create/mark promos.
-- Neither QR scan nor checklist count triggers promotions.

create or replace function laundry_private.grant_manual_promotion(
 p_member_id uuid,p_title text,p_terms text,p_expires_at timestamptz,p_request_id uuid
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_name text:=btrim(coalesce(p_title,'')); v_terms text:=nullif(btrim(coalesce(p_terms,'')),''); existing record;
begin
 if v_actor is null or not exists (
   select 1 from public.laundry_owner_accounts where auth_user_id=v_actor and is_active
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_request_id is null or p_member_id is null then raise exception 'invalid_request' using errcode='22023'; end if;
 if char_length(v_name) not between 3 and 120 or (v_terms is not null and char_length(v_terms)>2000)
 then raise exception 'invalid_promotion' using errcode='22023'; end if;
 if p_expires_at is not null and p_expires_at<=now()
 then raise exception 'invalid_expiration' using errcode='22023'; end if;
 if not exists(select 1 from public.laundry_members where id=p_member_id and is_active)
 then raise exception 'member_not_active' using errcode='22023'; end if;

 insert into public.laundry_member_promotions(
   member_id,title,terms,expires_at,request_id,created_by
 ) values(p_member_id,v_name,v_terms,p_expires_at,p_request_id,v_actor)
 on conflict(request_id) do nothing returning id into v_id;

 if v_id is null then
   select id,member_id,created_by,title,terms,expires_at into existing
   from public.laundry_member_promotions where request_id=p_request_id;
   if not found or existing.member_id is distinct from p_member_id
      or existing.created_by is distinct from v_actor or existing.title is distinct from v_name
      or existing.terms is distinct from v_terms or existing.expires_at is distinct from p_expires_at
   then raise exception 'idempotency_key_conflict' using errcode='23505'; end if;
   v_id:=existing.id;
 end if;
 return v_id;
end;
$$;
revoke all on function laundry_private.grant_manual_promotion(uuid,text,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function laundry_private.grant_manual_promotion(uuid,text,text,timestamptz,uuid) to authenticated;
create or replace function public.laundry_grant_manual_promotion(
 p_member_id uuid,p_title text,p_terms text,p_expires_at timestamptz,p_request_id uuid
) returns uuid language sql security invoker set search_path=''
as $$ select laundry_private.grant_manual_promotion(p_member_id,p_title,p_terms,p_expires_at,p_request_id); $$;
revoke all on function public.laundry_grant_manual_promotion(uuid,text,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.laundry_grant_manual_promotion(uuid,text,text,timestamptz,uuid) to authenticated;

create or replace function laundry_private.finish_manual_promotion(
 p_promotion_id uuid,p_member_id uuid,p_action text,p_reason text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_note text:=btrim(coalesce(p_reason,'')); v_count bigint;
begin
 if v_actor is null or not exists (
   select 1 from public.laundry_owner_accounts where auth_user_id=v_actor and is_active
 ) then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_promotion_id is null or p_member_id is null or p_action is null or p_action not in ('USE','CANCEL')
 then raise exception 'invalid_request' using errcode='22023'; end if;
 if p_action='CANCEL' and char_length(v_note) not between 3 and 500
 then raise exception 'invalid_cancel_reason' using errcode='22023'; end if;

 if p_action='USE' then
   update public.laundry_member_promotions
   set status='USED',redeemed_at=now(),redeemed_by=v_actor
   where id=p_promotion_id and member_id=p_member_id and status='AVAILABLE'
     and (expires_at is null or expires_at>now());
 else
   update public.laundry_member_promotions
   set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason=v_note
   where id=p_promotion_id and member_id=p_member_id and status='AVAILABLE';
 end if;
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'promo_not_available' using errcode='22023'; end if;
 return true;
end;
$$;
revoke all on function laundry_private.finish_manual_promotion(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function laundry_private.finish_manual_promotion(uuid,uuid,text,text) to authenticated;
create or replace function public.laundry_finish_manual_promotion(
 p_promotion_id uuid,p_member_id uuid,p_action text,p_reason text
) returns boolean language sql security invoker set search_path=''
as $$ select laundry_private.finish_manual_promotion(p_promotion_id,p_member_id,p_action,p_reason); $$;
revoke all on function public.laundry_finish_manual_promotion(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_finish_manual_promotion(uuid,uuid,text,text) to authenticated;

comment on function public.laundry_grant_manual_promotion(uuid,text,text,timestamptz,uuid) is
 'Explicit owner award only; independent of visits. Unique request UUID retries do not duplicate awards.';
comment on function public.laundry_finish_manual_promotion(uuid,uuid,text,text) is
 'Owner manually marks promo USED or CANCELLED; lifecycle is final and audit trigger records changes.';
