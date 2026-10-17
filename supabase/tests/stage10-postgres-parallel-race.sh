#!/usr/bin/env bash
set -euo pipefail
# Refuse every non-ephemeral destination. No Supabase network access.
if [[ "$PGDATABASE" != "laundry_qa_ci" || "$PGHOST" != "127.0.0.1" ]]; then
  echo "Refusing non-ephemeral PostgreSQL target" >&2
  exit 2
fi
OWNER="00000000-0000-4000-8000-000000000011"
MEMBER="00000000-0000-4000-8000-000000000012"
REQUEST="00000000-0000-4000-8000-000000000013"
psql -X -q -A -t -v ON_ERROR_STOP=1 >/dev/null <<SQL
INSERT INTO auth.users(id,aud,role) VALUES ('$OWNER','authenticated','authenticated');
INSERT INTO public.laundry_owner_accounts(auth_user_id,is_active) VALUES ('$OWNER',true);
INSERT INTO public.laundry_members(id,display_name,created_by)
 VALUES ('$MEMBER','Synthetic CI Concurrency Fixture','$OWNER');
INSERT INTO public.laundry_member_cards(member_id,token_digest,token_ciphertext,issued_by)
 VALUES ('$MEMBER',sha256(convert_to('ci-initial-card','UTF8')),decode(repeat('11',60),'hex'),'$OWNER');
SQL
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
run_card() {
  local worker="$1"
  psql -X -q -A -t -v ON_ERROR_STOP=1 > "$tmp_dir/card-$worker.out" 2>"$tmp_dir/card-$worker.err" <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$OWNER',true);
SELECT pg_sleep(0.4);
SELECT public.laundry_reissue_card(
 '$MEMBER'::uuid,'QA concurrent identical request',
 encode(sha256(convert_to('ci-card-$worker','UTF8')),'hex'),
 repeat('ab',60),'$REQUEST'::uuid);
SELECT pg_sleep(2);
COMMIT;
SQL
}
run_card a & pid_a=$!
run_card b & pid_b=$!
wait "$pid_a"
wait "$pid_b"
extract_uuid() {
  grep -E '^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}$' "$1" | tail -1
}
id_a="$(extract_uuid "$tmp_dir/card-a.out")"
id_b="$(extract_uuid "$tmp_dir/card-b.out")"
if [[ -z "$id_a" || "$id_a" != "$id_b" ]]; then
  echo "Parallel same-key RPC returned different card IDs" >&2
  cat "$tmp_dir"/card-*.err >&2
  exit 1
fi
psql -X -q -A -t -v ON_ERROR_STOP=1 > "$tmp_dir/card-audit.out" <<SQL
SELECT CASE WHEN count(*)=1 THEN 'OK' ELSE 'FAILED' END
FROM public.laundry_card_reissues WHERE member_id='$MEMBER'::uuid;
SELECT CASE WHEN count(*)=1 THEN 'OK' ELSE 'FAILED' END
FROM public.laundry_member_cards WHERE member_id='$MEMBER'::uuid AND revoked_at IS NULL;
SELECT CASE WHEN count(*)=1 THEN 'OK' ELSE 'FAILED' END
FROM public.laundry_member_cards WHERE member_id='$MEMBER'::uuid AND revoked_at IS NOT NULL;
SQL
if [[ $(grep -c '^OK$' "$tmp_dir/card-audit.out") -ne 3 ]]; then
 echo "Parallel card audit invariant failed" >&2; cat "$tmp_dir/card-audit.out" >&2; exit 1
fi
echo "PASS: two simultaneous transactions return a single replacement card"

psql -X -q -A -t -v ON_ERROR_STOP=1 -c 'DELETE FROM public.laundry_point_rules WHERE program_year=2027' >/dev/null
run_year() {
 local worker="$1"
 psql -X -q -A -t -v ON_ERROR_STOP=1 > "$tmp_dir/year-$worker.out" 2>"$tmp_dir/year-$worker.err" <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub','$OWNER',true);
SELECT pg_sleep(0.4);
SELECT public.laundry_initialize_point_year(2027);
SELECT pg_sleep(2);
COMMIT;
SQL
}
run_year a & pid_a=$!
run_year b & pid_b=$!
wait "$pid_a"
wait "$pid_b"
num_true="$(grep -h '^t$' "$tmp_dir"/year-*.out | wc -l | tr -d ' ')"
num_false="$(grep -h '^f$' "$tmp_dir"/year-*.out | wc -l | tr -d ' ')"
if [[ "$num_true" -ne 1 || "$num_false" -ne 1 ]]; then
 echo "Concurrent year creation failed to produce one winner" >&2
 cat "$tmp_dir"/year-*.out >&2; exit 1
fi
psql -X -q -A -t -v ON_ERROR_STOP=1 > "$tmp_dir/year-audit.out" <<SQL
SELECT CASE WHEN count(*)=1 THEN 'OK' ELSE 'FAILED' END
FROM public.laundry_point_rules WHERE program_year=2027;
SELECT CASE WHEN a.tiers=b.tiers THEN 'OK' ELSE 'FAILED' END
FROM public.laundry_point_rules a JOIN public.laundry_point_rules b ON b.program_year=2026
WHERE a.program_year=2027;
SELECT CASE WHEN count(*)=0 THEN 'OK' ELSE 'FAILED' END
FROM public.laundry_amount_transactions;
SQL
if [[ $(grep -c '^OK$' "$tmp_dir/year-audit.out") -ne 3 ]]; then
 echo "Concurrent year audit invariant failed" >&2; cat "$tmp_dir/year-audit.out" >&2; exit 1
fi
echo "PASS: two simultaneous next-year setups produce one insertion and preserve history"
