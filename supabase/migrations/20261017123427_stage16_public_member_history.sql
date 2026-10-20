-- Read-only capability lookup: possession of an active card QR authorizes
-- only that member's limited ledger. No names, contact details, notes or reasons.
create index if not exists laundry_public_history_member_time
 on public.laundry_checklist_events(member_id,occurred_at desc,id desc)
 where event_type='ADD';

create or replace function laundry_private.public_transaction_history(
 p_digest_hex text,p_year integer,p_page integer default 1
) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_member uuid; v_rows jsonb; v_page jsonb;
begin
 if p_digest_hex is null or p_digest_hex !~ '^[0-9a-f]{64}$'
   or p_year is null or p_year not between 2026 and 2100
   or p_page is null or p_page not between 1 and 10000 then return null; end if;
 select c.member_id into v_member
 from public.laundry_member_cards c join public.laundry_members m on m.id=c.member_id
 where c.token_digest=decode(p_digest_hex,'hex') and c.revoked_at is null and m.is_active;
 if v_member is null then return null; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at desc,q.event_id desc),'[]'::jsonb)
 into v_rows from (
  select e.id as event_id,e.occurred_at,t.amount_idr,t.program_year,
   coalesce(t.awarded_points,0) as awarded_points,
   exists(select 1 from public.laundry_checklist_events rev
     where rev.reverses_event_id=e.id and rev.member_id=v_member and rev.event_type='VOID') as cancelled
  from public.laundry_checklist_events e
  left join public.laundry_amount_transactions t on t.visit_event_id=e.id and t.member_id=v_member
  where e.member_id=v_member and e.event_type='ADD'
   and coalesce(t.program_year,extract(year from e.occurred_at at time zone 'Asia/Jakarta')::integer)=p_year
  order by e.occurred_at desc,e.id desc
  offset ((p_page-1)*20) limit 21
 ) q;
 select coalesce(jsonb_agg(j.value order by j.ordinality),'[]'::jsonb) into v_page
 from jsonb_array_elements(v_rows) with ordinality j where j.ordinality<=20;
 return jsonb_build_object('transactions',v_page,'has_older',jsonb_array_length(v_rows)>20,'page',p_page);
end;
$$;
revoke all on function laundry_private.public_transaction_history(text,integer,integer) from public,anon,authenticated;
grant execute on function laundry_private.public_transaction_history(text,integer,integer) to anon,authenticated;
create or replace function public.laundry_public_transaction_history(
 p_digest_hex text,p_year integer,p_page integer default 1
) returns jsonb
language sql stable security invoker set search_path=''
as $$ select laundry_private.public_transaction_history(p_digest_hex,p_year,p_page); $$;
revoke all on function public.laundry_public_transaction_history(text,integer,integer) from public,anon,authenticated;
grant execute on function public.laundry_public_transaction_history(text,integer,integer) to anon,authenticated;
comment on function public.laundry_public_transaction_history(text,integer,integer) is
 'Active-card-scoped paginated history: date, amount, original points, program year and cancellation status only. No PII, notes, mutation or cross-member selector.';
