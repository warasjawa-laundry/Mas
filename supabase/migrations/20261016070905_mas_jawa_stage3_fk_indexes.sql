create index laundry_members_created_by_idx on public.laundry_members(created_by);
create index laundry_card_issued_by_idx on public.laundry_member_cards(issued_by);
create index laundry_card_revoked_by_idx on public.laundry_member_cards(revoked_by) where revoked_by is not null;
create index laundry_checklist_actor_idx on public.laundry_checklist_events(actor_id);
create index laundry_promo_created_by_idx on public.laundry_member_promotions(created_by);
create index laundry_promo_redeemed_by_idx on public.laundry_member_promotions(redeemed_by) where redeemed_by is not null;
create index laundry_promo_cancelled_by_idx on public.laundry_member_promotions(cancelled_by) where cancelled_by is not null;
create index laundry_audit_actor_idx on public.laundry_audit_events(actor_id) where actor_id is not null;