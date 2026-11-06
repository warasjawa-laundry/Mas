-- Read-only comparison query used for the V3.1 release capture.
-- Digests compare complete sorted JSON rows, not a backup or signed attestation.
select 'laundry_members' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_members t
union all
select 'laundry_member_cards' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_member_cards t
union all
select 'laundry_checklist_events' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_checklist_events t
union all
select 'laundry_amount_transactions' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_amount_transactions t
union all
select 'laundry_point_rules' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_point_rules t
union all
select 'laundry_services' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_services t
union all
select 'laundry_pos_duration_packages' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_pos_duration_packages t
union all
select 'laundry_pos_service_families' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_pos_service_families t
union all
select 'laundry_pos_outlets' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_pos_outlets t
union all
select 'laundry_pos_orders' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_pos_orders t
union all
select 'laundry_pos_payments' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_pos_payments t
union all
select 'laundry_pos_cash_ledger' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_pos_cash_ledger t
union all
select 'laundry_pos_point_links' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_pos_point_links t
union all
select 'laundry_pos_cash_shifts' dataset,count(*)::integer rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from public.laundry_pos_cash_shifts t;

