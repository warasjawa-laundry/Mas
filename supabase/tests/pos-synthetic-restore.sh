#!/usr/bin/env bash
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "laundry_qa_ci" ]]; then
 echo 'REFUSED: restore rehearsal requires synthetic ephemeral CI database' >&2; exit 2
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
: "${POSTGRES_CONTAINER:?CI PostgreSQL service container required}"
# Use server-matched binaries; the Ubuntu client package may be an older major.
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDATABASE" --format=custom --no-owner >"$tmp/synthetic.dump"
docker exec "$POSTGRES_CONTAINER" createdb -U "$PGUSER" laundry_qa_restore_ci
docker exec -i "$POSTGRES_CONTAINER" pg_restore -U "$PGUSER" --exit-on-error --no-owner --dbname=laundry_qa_restore_ci <"$tmp/synthetic.dump"
fingerprint(){
 local database="$1"
 psql -XAt --dbname="$database" -v ON_ERROR_STOP=1 -c "select schemaname||'.'||tablename from pg_tables where schemaname in ('public','auth','laundry_private') order by 1" |
 while IFS= read -r table; do
  printf '%s ' "$table"
  psql -XAt --dbname="$database" -v ON_ERROR_STOP=1 -c "select count(*)||':'||md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from $table t"
 done
 psql -XAt --dbname="$database" -v ON_ERROR_STOP=1 -c "select n.nspname,c.relname,c.relrowsecurity,coalesce(c.relacl::text,'') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','laundry_private') and c.relkind='r' order by 1,2"
}
fingerprint laundry_qa_ci >"$tmp/before"
fingerprint laundry_qa_restore_ci >"$tmp/after"
diff -u "$tmp/before" "$tmp/after"
for regression in pos-owner-duration-rollback.sql pos-owner-operations-rollback.sql pos-import-audit-rollback.sql pos-cashier-recovery-rollback.sql 20261017_stage10_role_isolation_rollback.sql; do
 psql -X --dbname=laundry_qa_restore_ci -v ON_ERROR_STOP=1 -f "supabase/tests/$regression" >/dev/null
done
psql -X --dbname=laundry_qa_restore_ci -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$begin
 if exists(select 1 from public.laundry_pos_outlets where write_enabled or finance_enabled)
 then raise exception 'restore left writes enabled';end if;
end$$;
SQL
echo 'PASS: synthetic dump restored with identical row fingerprints, RLS and table ACLs'
