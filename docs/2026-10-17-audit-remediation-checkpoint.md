# Audit remediation, 17 October 2026

## Implemented

- Member history pages through 30 events at a time, ordered by occurred_at and id. Navigation keeps the history section open and provides a route back to the newest page.
- Amount metadata is fetched for the ADD IDs on the current page. A failed amount query displays an unavailable message instead of falsely labelling transactions as legacy zero-point entries.
- VOID lookup is independent of pagination. An ADD whose correction is on another page is still marked cancelled. Cancellation controls are suppressed when the correction lookup fails.
- Nine history/query/render regressions and four migration reconciliation regressions were added.
- A new Audit release gate job runs tests, typecheck, build and all UI specs on every PR to main and push to main, without path filters. Repository required-check enforcement still needs an administrative setting; creating a workflow alone does not enforce it.
- PostgreSQL CI now executes the existing rollback integration and role-isolation suites as well as the new read-only maintenance check, before the existing two-connection concurrency test.

## Database maintenance completed

User instruction: fix the findings of the audit. Maintenance was applied to isolated QA first, then to the customer project after QA checks passed.

| Project | Applied maintenance | Verification |
|---|---|---|
| QA tnadzytuamdxfypoeggy | Stage 15; 7 FK indexes; application role rule mutations denied; migration versions reconciled | SQL role isolation and card integration passed; read-only index/privilege check passed; advisor has no unindexed_foreign_keys findings |
| Customer hncfyfvqtlnvqyfrydzb | Stage 15; 5 FK indexes; rule mutations denied; existing migration versions reconciled | Read-only index/privilege check passed; advisor has no unindexed_foreign_keys findings; baseline counts and complete point-rule rows unchanged |

The customer database still has no Stage 10 reissue journal or initialization RPC. Stage 15 deliberately handles their absence without enabling those features. Stage 10 and Stage 11 remain pending for the separately managed application release; do not replay old migrations or assume all missing stages were applied by maintenance.

Point-rule reads and the amount-transaction scoring RPC remain available to authenticated owners. No rules, balances, members, transactions, promotions, cards or encryption keys were modified by maintenance. QA synthetic Auth/member fixtures were confined to transactions ending in ROLLBACK; no synthetic fixture was executed against the customer project.

## Migration reconciliation

All seven customer historical migration bodies and all nine pre-maintenance QA bodies matched the repository after CRLF normalization and trimming outer whitespace. The new Stage 15 body was verified in the same way. Only the version column of verified migration-history rows was updated, under a transaction and table lock; migration bodies were not executed again.

Reproducible check:

1. Export `select version,name,statements from supabase_migrations.schema_migrations order by version` to a private JSON array outside the repository.
2. Run `node scripts/reconcile-migration-history.mjs HISTORY.json --check`.
3. Only after all hashes match, `--sql` emits an explicit transaction for review/execution. The tool never connects to a database or runs SQL itself.
4. The transaction rechecks the live body hash, name, timestamp and collisions before each update. Unknown, duplicate, split or modified migration bodies fail closed. Newly missing stages are reported, not marked applied.

Do not commit exports of remote migration history, credentials, environment files or generated runtime artifacts.

## Validation

- `npm test`: 108 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- All 42 existing Playwright specs passed against the local production build, using a scratch-only Chromium 153 binary. Standard Playwright Chromium download was unavailable in this execution environment. The scratch browser/config are not repository dependencies or release artifacts.
- Local image optimization requests to raw.githubusercontent.com encountered DNS restrictions. Browser assertions passed, but these checks are not verification of live remote-image delivery.
- History regressions exercise 65 events, equal timestamps, metadata on older pages, member scoping, cross-page VOID, unavailable amount/reversal queries, empty pages, bounds, labels and cancellation controls.
- No real owner credentials were used; authenticated mobile UAT on the live Preview remains distinct from these local browser and SQL checks.

## Settings blocked by connector capabilities

These items are not reported as completed:

1. GitHub branch protection: current GitHub connection offers reads but no administration write for protection/rulesets. Enable protection for main and require the unique **Audit release gate** check after it appears, plus the PostgreSQL job as appropriate. Avoid requiring an independent human approval when this repository has no second reviewer unless the owner explicitly chooses that policy.
2. Supabase leaked-password protection: no Auth configuration write is exposed by the available Supabase tools. The feature also requires an eligible plan. Both projects retain the advisor warning until changed in Auth settings.
3. Vercel shared Preview encryption-key classification: a metadata-only conversion was attempted without reading or replacing the key. The API requires visibility=secret, which the connected update schema does not expose. The call failed and the existing key was preserved. The QA branch-specific key is already sensitive. No key rotation was attempted.

These capability gaps do not block pushing the code fixes or updating the isolated QA Preview. No main merge, official production deployment or DNS change is included in this remediation.
