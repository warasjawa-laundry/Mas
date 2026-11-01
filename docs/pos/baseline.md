# G0 baseline POS, 1 November 2026

User approved implementation of V2 and decisions D01–D11 in this chat. Production cutover remains a separate gate. Work uses a clean clone on `feature/pos-foundation-v2`; previous scratch changes are not reused.

## Source and production

- Frozen remote main: `3bef1a50f132f6a5916a1109de5ab9c97c5f9e75`, tree `0625f310b59b4e22d04dde3a9d86655bafe5823d`.
- Operational Supabase: `hncfyfvqtlnvqyfrydzb`, org `irwtmqbaqcnbxuuyamvk`, ap-south-1, ACTIVE_HEALTHY, PostgreSQL 17.11.
- Vercel project `mas`, `prj_XaFKO8opffvnhL9c0oE3GrGPt3H2`, team `team_lAFGfoJ0FshlxvkpR2f2H5Hu`; current production `dpl_2n1WZPQtuF4BWGB8m4FkSY9uRwnS`, READY, Mumbai. Production deployment was not changed for POS.
- Actual Git connection returned by Vercel: `unyilhm1-hue/mas`. This differs from source `warasjawa-laundry/Mas`. Creating a branch-scoped environment for the real source branch fails `BAD_REQUEST: Branch not found in the connected Git repository`, even though `git ls-remote` verifies it exists in the intended repo.

## Read-only data snapshot

Captured by one SELECT/MVCC statement at `2026-11-01 11:34:33.523163+00`. Reproducible query: `queries/baseline.sql`. Full fingerprints/column/function/grant/policy/migration metadata remain in ignored private task artifacts. No member names, phone numbers, raw card tokens, encryption keys or row contents are copied to this document or PR.

| Table | Rows |
| --- | ---: |
| laundry_members | 785 |
| laundry_member_cards | 18 total |
| laundry_amount_transactions | 19 |
| laundry_checklist_events | 21 |
| laundry_member_promotions | 5 |
| laundry_point_rules | 2 |
| laundry_services | 9 |

Years 2026/2027 both revision 1: 10,000 -> 1; 25,000 -> 3; 50,000 -> 5; 100,000 -> 10; 200,000 -> 20. These are captured configuration values, not constants to embed in POS code.

There are 17 canonical migrations and 46 application functions in the captured public/laundry_private scope. Counts differ from the October checkpoint because real business activity has continued; prior counts are not used as a frozen expectation.

## QA reconstruction evidence

User approved the quoted US$0/month clean project in the same organization, Mumbai. Created project `cwxsbgfjynwxqalwonae`, name `mas-jawa-pos-qa`, ACTIVE_HEALTHY. Old QA `tnadzytuamdxfypoeggy` remains INACTIVE and untouched.

Replayed all 17 repository migrations into the empty QA schema using apply_migration. MCP-generated execution timestamps were reconciled to the original canonical filenames only after an exact SQL-array equality guard matched the applied statement; no migration was replayed twice. Canonical version/name history matches operational baseline. All 46 function definition hashes match operational baseline.

QA contains zero members, cards, amount transactions, checklist events and promos; consolidation archive contains zero customer payloads. The migration seeds two year configurations and eight original catalog records, not the nine live customer-managed service records. No live customer data/archive is copied.

Eight repository SQL regressions passed against this QA using synthetic fixtures and rollback; catalog/privilege read-only checks were wrapped in BEGIN/ROLLBACK as well. Member rows were verified empty afterward. This is not a claim that POS concurrency or authenticated cashier UAT has passed.

## Baseline verification and outstanding gates

- Clean-source Node baseline: 151 passed before edits.
- New foundation verification is recorded separately in the PR/checkpoint; no payment UI/RPC is exposed yet.
- Supabase security advisor: INFO default-deny RLS without policies on three restricted tables; retained intentionally pending privilege review. Existing WARN leaked-password protection disabled; not changed during baseline. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection reference](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- This snapshot is not a backup. Restore rehearsal/production backup evidence remains a release gate.
- Binatu reference screenshots and Excel fixture mentioned in V1 are not present among the current plan attachments. They must be supplied/inventoried before claiming visual parity or format compatibility.
- Browser tool currently reports local browser use disabled. No physical-device or live authenticated browser verification is claimed in this stage.
