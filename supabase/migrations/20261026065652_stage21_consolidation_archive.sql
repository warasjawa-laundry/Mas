create table laundry_private.consolidation_archives (
  source_project text not null,
  snapshot_digest text not null check(snapshot_digest ~ '^[0-9a-f]{64}$'),
  snapshot_text text not null default '',
  member_mapping jsonb not null default '[]'::jsonb,
  status text not null default 'staging' check(status in ('staging','complete')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(source_project,snapshot_digest)
);
alter table laundry_private.consolidation_archives enable row level security;
revoke all on laundry_private.consolidation_archives from public,anon,authenticated,service_role;
comment on table laundry_private.consolidation_archives is
  'Administrator-only source archive and member-ID mapping for verified database consolidation. Contains private customer data and encrypted card material; never expose through the Data API.';
