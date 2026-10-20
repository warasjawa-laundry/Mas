-- Customer import support. Source workbook/contacts must never be committed.
alter table public.laundry_members add column address text
  check (address is null or char_length(address) between 1 and 1000);
comment on column public.laundry_members.address is
  'Optional customer address, owner-only through existing member RLS. Not returned by public card functions.';

create table public.laundry_member_import_rows (
 source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
 source_row integer not null check (source_row > 1),
 member_id uuid not null references public.laundry_members(id) on delete restrict,
 source_phone text not null check (char_length(source_phone) <= 100),
 phone_needs_review boolean not null,
 linked_existing boolean not null,
 imported_by uuid not null references public.laundry_owner_accounts(auth_user_id),
 imported_at timestamptz not null default now(),
 primary key(source_sha256,source_row)
);
create index laundry_import_member on public.laundry_member_import_rows(member_id);
create index laundry_import_actor on public.laundry_member_import_rows(imported_by);
alter table public.laundry_member_import_rows enable row level security;
revoke all on public.laundry_member_import_rows from public,anon,authenticated;
grant select on public.laundry_member_import_rows to authenticated;
create policy laundry_owners_read_imports on public.laundry_member_import_rows
 for select to authenticated using (exists (
  select 1 from public.laundry_owner_accounts
  where auth_user_id=(select auth.uid()) and is_active
 ));
comment on table public.laundry_member_import_rows is
 'Owner-only import provenance and original phone for correction. File hash plus row prevents repeated imports. No promotional consent implied.';

-- An imported member exists before receiving a physical card. The application
-- creates the token using its existing server key when the owner requests it.
-- A member row lock makes retries/double submissions return the existing card.
create function laundry_private.issue_imported_member_card(
 p_member_id uuid,p_token_digest_hex text,p_token_ciphertext_hex text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_card uuid; v_member public.laundry_members;
begin
 if v_owner is null or not exists(select 1 from public.laundry_owner_accounts where auth_user_id=v_owner and is_active)
 then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_token_digest_hex is null or p_token_digest_hex !~ '^[0-9a-f]{64}$'
  or p_token_ciphertext_hex is null or p_token_ciphertext_hex !~ '^[0-9a-f]{142}$'
 then raise exception 'invalid_card_material' using errcode='22023'; end if;
 select * into v_member from public.laundry_members where id=p_member_id for update;
 if not found or not v_member.is_active then raise exception 'member_not_available' using errcode='22023'; end if;
 if not exists(select 1 from public.laundry_member_import_rows where member_id=p_member_id)
 then raise exception 'not_imported_member' using errcode='22023'; end if;
 select id into v_card from public.laundry_member_cards where member_id=p_member_id and revoked_at is null;
 if v_card is not null then return v_card; end if;
 -- A revoked card must go through the separate lost-card policy, never initial issuance.
 if exists(select 1 from public.laundry_member_cards where member_id=p_member_id)
 then raise exception 'card_already_issued' using errcode='22023'; end if;
 insert into public.laundry_member_cards(member_id,token_digest,token_ciphertext,issued_by)
 values(p_member_id,decode(p_token_digest_hex,'hex'),decode(p_token_ciphertext_hex,'hex'),v_owner)
 returning id into v_card;
 insert into public.laundry_audit_events(actor_id,entity_type,entity_id,action,context)
 values(v_owner,'member_card',v_card,'INITIAL_CARD_ISSUED',jsonb_build_object('member_id',p_member_id));
 return v_card;
end; $$;
revoke all on function laundry_private.issue_imported_member_card(uuid,text,text) from public,anon,authenticated;
grant execute on function laundry_private.issue_imported_member_card(uuid,text,text) to authenticated;
create function public.laundry_issue_imported_member_card(
 p_member_id uuid,p_token_digest_hex text,p_token_ciphertext_hex text
) returns uuid language sql security invoker set search_path='' as $$
 select laundry_private.issue_imported_member_card(p_member_id,p_token_digest_hex,p_token_ciphertext_hex);
$$;
revoke all on function public.laundry_issue_imported_member_card(uuid,text,text) from public,anon,authenticated;
grant execute on function public.laundry_issue_imported_member_card(uuid,text,text) to authenticated;
