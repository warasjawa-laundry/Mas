-- Add only member-facing promotion details to the existing card-scoped response.
-- Return signature and caller privileges stay compatible with older deployments.
create or replace function laundry_private.public_card_progress(p_digest_hex text)
returns table(member_number bigint, visit_count bigint, promos jsonb)
language plpgsql security definer set search_path=''
as $$
begin
 if p_digest_hex is null or p_digest_hex !~ '^[0-9a-f]{64}$' then return; end if;
 return query
 select m.member_number,
   (select count(*)::bigint
      from public.laundry_checklist_events e
      where e.member_id=m.id and e.event_type='ADD'
        and not exists (
         select 1 from public.laundry_checklist_events void
         where void.reverses_event_id=e.id and void.event_type='VOID'
        )
   ),
   coalesce((
     select jsonb_agg(jsonb_build_object(
       'title',p.title,'status',p.status,'terms',p.terms,'expires_at',p.expires_at
     ) order by p.created_at desc,p.id desc)
     from public.laundry_member_promotions p
     where p.member_id=m.id and p.status='AVAILABLE'
       and (p.expires_at is null or p.expires_at > now())
   ),'[]'::jsonb)
 from public.laundry_member_cards c
 join public.laundry_members m on m.id=c.member_id
 where c.revoked_at is null and m.is_active
   and c.token_digest=decode(p_digest_hex,'hex');
end;
$$;
revoke all on function laundry_private.public_card_progress(text) from public;
grant execute on function laundry_private.public_card_progress(text) to anon,authenticated;
