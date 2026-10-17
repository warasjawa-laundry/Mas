-- Stage 11: points thresholds are an operator-managed database policy.
-- Stage 9 and 10 granted owners authenticated RPC execution; staff may
-- share an owner login. Removing UI controls alone would NOT close this risk.
-- Grant NO application identity permission to change or initialize tiers.
-- Existing point rows, balances, visits and read/scoring RPCs are untouched.
-- Changes in future require a privileged DBA SQL migration, reviewed separately.
revoke execute on function public.laundry_set_point_rules(integer,jsonb,integer)
  from public, anon, authenticated, service_role;
revoke execute on function laundry_private.set_point_rules(integer,jsonb,integer)
  from public, anon, authenticated, service_role;
revoke execute on function public.laundry_initialize_point_year(integer)
  from public, anon, authenticated, service_role;
revoke execute on function laundry_private.initialize_point_year(integer)
  from public, anon, authenticated, service_role;

-- Defense in depth: rule data still readable through authenticated RLS,
-- but no browser role can directly modify the point policy.
revoke insert, update, delete, truncate on public.laundry_point_rules
  from public, anon, authenticated, service_role;

comment on function public.laundry_set_point_rules(integer,jsonb,integer) is
  'Operator-only maintenance: execution revoked from API/browser roles. Do not regrant to authenticated.';
comment on function public.laundry_initialize_point_year(integer) is
  'Operator-only annual policy provisioning: execution revoked from API/browser roles.';
