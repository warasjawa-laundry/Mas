# Mas Jawa Laundry — Operational Dashboard & Reliability Implementation Plan

**Date:** 2026-10-17 (WIB)  
**Branch:** `feature/admin-operations-reliability-20261017`  
**Base:** `50d9bd922c57448d5316a1584e6fc26b14a2e1eb` (PR #10)  
**Scope:** QR compatibility, owner dashboard/navigation, transaction UX, repeatable tests, security/performance reviews.  
**Status:** Stage 0–3 implementation COMPLETE (CI 6/6 PASS on candidate `4729a62`); Stage 4 SOURCE + ISOLATED SQL QA TESTS PASS; concurrent SQL and authenticated browser UAT GATED; Stage 5 authenticated Preview UAT PENDING. `main` and production unchanged.

## Guardrails and invariants

- No changes to `main`, Netlify site/domain redirects, DNS, GSC, ristkyx Vercel production, customer member Kiki or live records.
- No direct production Supabase SQL/migration execution or password manipulation. New migration requires separate approval and staged integration test before applying.
- Owner access must continue to require live Supabase Auth identity AND active `laundry_owner_accounts` check before reading or writing protected data. Leave RLS and SQL atomic/idempotency protections intact.
- QR scans are read-only. Transactions/points are written only by explicit owner actions. No WhatsApp auto-send; respect opt-in consent.
- Preview-only testing under unyil Vercel `mas`, `bom1`, protected access. A READY build or source-matching test is not an authenticated UAT.
- `vercel.json` disables Git-triggered deployments; issue deliberate Preview deployment only after passing gates.

## Problem inventory and implementation approach

| ID | Priority | Finding | Target |
|---|---|---|---|
| QR-01 | P1 | Preview QR uses immutable `VERCEL_URL` while scanner allowlist excludes current unyil hostname | Stable Preview QR origin, strict QR host allowlist, known legacy support, runnable positive/negative tests |
| QR-02 | P1 | Revoke/reissue workflow lacks owner UI; migration declares reissue deferred | Design and implement safe idempotent reissue + revocation only after SQL staging, no live SQL without approval |
| ADM-01 | P2 | Each admin page hand-rolls navigation; no owner start page | Shared mobile/desktop shell, `/admin` dashboard, scan first, no extra auth round-trip in shell |
| ADM-02 | P2 | Member detail scrolls through count/points/history/promo before or after action | Compact action-first member workspace without disturbing action contracts |
| ADM-03 | P2 | Search hard-limits 100 and no pagination | Server-side controlled pagination with bounded search, stable sort |
| POINT-01 | P2 | Rules UI restricts year to 2026/2027; new year cannot be configured | Versioned plan for future-year rules, migration & tests behind database-approval gate |
| PERF-01 | P2 | Eight member detail requests and no before/after latency evidence | Log timings, trim non-critical initial fetches where safe, protected measured UAT |
| TEST-01 | P2 | Most CI tests assert static source; no signed-in owner/QR/transaction/void E2E | Add executable QR tests and authenticated staging E2E with seeded, isolated fixture |
| SEC-01 | P3 | Security advisor: leaked-password protection disabled; 5 unindexed FKs | Verify/configure only after separate Auth/SQL approval; avoid unneeded index churn |

## Checkpoint ledger (update after EVERY implementation stage)

- [x] **Stage 0 — Audit and implementation contract**. Branch isolated from `main`; scope, invariants, release gates and findings documented. Evidence: branch and this plan.
- [x] **Stage 1 — QR origin/allowlist + regression tests**. Acceptance: generated QR on Preview uses stable alias, no unsafe host allowed, existing recognized legacy QR still decodes.
- [x] **Stage 2 — Owner dashboard and consistent admin shell**. Acceptance: authenticated `/admin`, scan/member/settings links, accessible 320–1440px layout, no extra Auth/db lookup from shell.
- [x] **Stage 3 — Faster member operations and compact responsive UX**. Acceptance: owner member detail keeps amount, points, void, promo, consent, QR routes intact; action-first on mobile.
- [ ] **Stage 4 — Card lifecycle and future-year points (schema-gated)**. Acceptance: migrations reviewable and tested on isolated database; never applied live as a side effect of merging.
- [ ] **Stage 5 — Verification and release certification**. Acceptance: `npm test`, `tsc`, `next build`, Playwright CI, Vercel unyil Preview READY in `bom1`; security regression + authenticated UAT documented.

## Release gate

- [ ] Tests and TypeScript/build PASS for exact candidate SHA.
- [ ] No P0/P1 functional findings remain in candidate scope.
- [ ] Owner approval for deployment/DB schema and production promotion separately.
- [ ] Validate QR link *and actual scanner* on the same Preview build with approved test member (never mutate Kiki).
- [ ] Confirm cancellation, yearly points, and public progress across two environments before domain cutover.

## Stage notes

### Stage 0 — COMPLETE (2026-10-17)

- Confirmed `main` SHA `50d9bd9`.
- Findings reproduced from `lib/laundry/card.ts`, `lib/laundry/scan.ts`, `app/admin/layout.tsx`, `app/admin/members/[id]/page.tsx`, and existing stage migrations.
- Existing CI relies heavily on source contracts; add executable tests instead of claiming coverage from regex checks.
- Work proceeds on `feature/admin-operations-reliability-20261017`; all production resources remain unchanged.

### Pending checkpoint updates

Record actual files changed, test command and result, SHA, exceptions, and status after each stage. Do not mark a stage COMPLETE without its stated evidence.

### Stage 1 — IMPLEMENTATION COMPLETE / QA browser pending (2026-10-17)

- Stable canonical Preview origin and official production origin: `lib/laundry/card-origins.ts`.
- `lib/laundry/card.ts` no longer embeds one-off Vercel deployment URL; `lib/laundry/scan.ts` accepts stable review and tightly-scoped historical preview hostnames while rejecting untrusted URL schemes, hosts and userinfo.
- Executable positive/negative parser tests: `tests/qr-canonical-links.test.mjs`. Legacy source-contract test updated to follow the shared constant.
- All 6 GitHub CI workflows passed for candidate `4729a6274e1e8424781094d8add4bf38cce376d8`.
- **Residual gate:** physical QR scan AND opening `/k/<token>` in same authenticated review deployment; QR tokens are bearer credentials and must not appear in logs.

### Stage 2 — IMPLEMENTATION COMPLETE / mobile QA pending (2026-10-17)

- `app/admin/page.tsx`: owner-protected dashboard with three small count queries, scan-first action, quick links, safe fallback on read error.
- `components/admin/admin-navigation.tsx` and `app/admin/layout.tsx`: shared desktop sidebar/mobile bottom nav; nav makes no database/Auth calls.
- Successful login and signed-in login-page redirect now point to `/admin`.
- `app/admin/admin.css`: adaptive layout, selected states, keyboard focus and reduced mobile scroll.
- Tests: `tests/admin-operations.test.mjs`; CI 6/6 PASS on `4729a62`.
- **Residual gate:** measure and visually inspect 320/360/390/768/1440 px with signed-in owner on Preview.

### Stage 3 — IMPLEMENTATION COMPLETE / UAT pending (2026-10-17)

- `app/admin/members/page.tsx`: server pagination 25/page, deterministic sort, bounded page number and preserved query in page links.
- `app/admin/members/[id]/page.tsx`: move secondary links after amount-entry form, collapse transaction correction history, keep promo and points contracts.
- `app/admin/admin.css`: compact summary cards and bounded pagination controls.
- CI 6/6 PASS on `4729a62`. No migration, auth policy, transaction, point rules, or consent logic changed.
- **Residual gate:** owner UAT on valid test member; compare latency, verify form submit, correction, promo, WhatsApp permissions and mobile overflow.

### Stage 4 — DESIGN GATED (2026-10-17)

See `docs/2026-10-17-stage4-card-and-future-points-contract.md`. Production SQL not executed. This is **not** marked complete.

### Stage 5 — VALIDATION IN PROGRESS (2026-10-17)

GitHub CI 6/6 PASS at SHA `4729a62`: Integration `38957119789`, Stage 2 `38957119738`, Stage 3 `38957119930`, Stage 4 `38957119756`, Stage 5 `38957119765`, Stage 6 `38957119923`. Each job runs appropriate subset of source tests, typecheck/build and Playwright. Authenticated test and Preview UAT remain blocked/pending.

### Stage 2 amendment — Main/feature Preview navigation isolation

- `lib/navigation.ts` routes to fixed review-main alias ONLY for `VERCEL_ENV=preview` AND `VERCEL_GIT_COMMIT_REF=main`.
- Feature previews, Netlify, and production retain relative links on their own hosts; prevents UAT silently switching to old main.
- New executable tests: `tests/preview-navigation.test.mjs`; source contract updated.
- This amendment and CI were validated on code SHA `7f89d3107e07e4bcc092af8170ac4529545ab88f`.

### Stage 5 update — Preview created 2026-10-17

- [x] Six GitHub CI suites PASS at `7f89d31`, including TypeScript, build and available browser tests.
- [x] **One** manual unyil Vercel Preview deployment: `dpl_9g7wikotpv1VYT9ZGzTwnuPdKCKA` — READY, region `bom1`.
- [x] Exact deployed Git SHA `7f89d31` and branch `feature/admin-operations-reliability-20261017` verified.
- [x] Branch alias verified points to the deployment: `https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app`.
- [ ] Authenticated manual UAT on mobile and desktop. Deployment has Vercel Authentication; a READY build is not proof of login, successful transaction, or performance improvement.
- [ ] QR public progress end-to-end on the *eventual main/stable domain*. Branch Preview deliberately embeds the stable main test origin, so public QR entry cannot yet certify the feature branch in isolation.
- [ ] Stage 4 isolated database migration and regression tests before lifecycle release.
- [ ] Separate release approval before merge to `main` or production promotion.

### Stage 4 — SOURCE IMPLEMENTATION CHECKPOINT (2026-10-17 WIB)

**Code PASS, not DB-certified:** `0798e10e2613500f3ecded78764f2e461984dfc9` — six out of six GitHub Actions workflows SUCCESS. Historical `main` still `50d9bd9`.

- [x] Added migration `20261017090000_stage10_card_reissue_and_next_year.sql`: atomic/idempotent owner card reissue; audit journal with RLS, explicit rule-year initialization preserving snapshots.
- [x] Added owner-only feature-gated card reissue action and confirmation panel. Feature flag `OWNER_CARD_REISSUE_ENABLED` absent/off by default.
- [x] Added current/next WIB program-year logic and owner UI. Flag `OWNER_POINT_YEAR_SETUP_ENABLED` absent/off by default.
- [x] Updated public customer balance display and owner member detail for future WIB years; 2026 trial remains separate.
- [x] Wrote `tests/stage10-contract.test.mjs`: executable time-boundary tests and security/source contracts. Current CI includes all six workflow gates with successful TypeScript, build and browser tests.
- [x] Create isolated Supabase QA project (`tnadzytuamdxfypoeggy`, Mumbai); cost quoted US$0/month.
- [x] Replay 8 migrations (including exact recovered Stage 3 sources) in QA.
- [x] Run rollback-only PostgreSQL integration, idempotency, owner/anon privilege and RLS tests in QA; synthetic data removed.
- [ ] Run **true concurrent-session** card rotation and points setup integration tests with an isolated QA fixture.
- [ ] Authenticated owner UAT against QA-only Preview after isolated env wiring.
- [ ] Production SQL authorization and independent rollout approval.

Details: `docs/2026-10-17-stage4-implementation-checkpoint.md`. Previous unyil Preview READY build is **pre-Stage-4**. No production deployment or customer record mutation.

### Stage 4 — ISOLATED SQL QA CHECKPOINT (2026-10-17 WIB)
- [x] Supabase `mas-jawa-laundry-qa` ref `tnadzytuamdxfypoeggy` created in `warasjawa-laundry's Org`, Mumbai `ap-south-1`. Supabase quoted **US$0/month** for the project creation.
- [x] Retrieved the *exact* two Stage 3 DDL sources from original production migration history (no customer records or credentials); checked in under `supabase/migrations/20261016070822_*.sql` and `20261016070905_*.sql`.
- [x] Applied 8 of 8 migrations on **QA ID only**: Stage 3 foundation, Stage 3 indexes, Stage 4, 5, 6, 8, 9, 10.
- [x] `supabase/tests/20261017_stage10_sql_integration_rollback.sql`: **PASS** for old QR revocation, new token success, reissue UUID idempotency, conflicting reason/owner refusal, unauthenticated denial, and year setup guards.
- [x] `supabase/tests/20261017_stage10_role_isolation_rollback.sql`: **PASS** as real PostgreSQL `authenticated` and `anon` roles with RLS.
- [x] QA post-ROLLBACK: **0 auth users, 0 owners, 0 members, 0 cards, 0 reissues**; two preset point-rule rows (2026 and 2027), 5 tiers each. RLS on all ten QA business tables.
- [x] Security advisor: only two `rls_enabled_no_policy` informational notes for token/audit tables intentionally not directly exposed. Performance advisor: seven informational unindexed foreign keys and nine unused-index notices; no automatic schema churn.
- [x] True independent two-session concurrency on ephemeral PostgreSQL 17 (`supabase/tests/stage10-postgres-parallel-race.sh`) — Stage 10 workflow PASS; same-key replacement produces one new card/audit, simultaneous year creation produces one insert.
- [ ] Isolated QA authenticated browser UAT, response timings and separate release approval.
- [ ] Production migration & promotion: **not authorized**.

Evidence: `docs/2026-10-17-stage4-supabase-qa-checkpoint.md`. Neither customer database nor main/prod hosting modified.

### Stage 5 — CONCURRENCY AND QA PREVIEW ISOLATION CHECKPOINT (2026-10-17)
- [x] New dedicated `.github/workflows/stage10-postgres-concurrency.yml`: PostgreSQL 17 service container, eight source migrations, independent concurrent PostgreSQL client processes. True parallel card-reissue and next-year setup tests **PASS** (run `39004521560`; all **7/7** workflows PASS on SHA `61957576a25fc73b34996e8c3017b4f47fc77a82`).
- [x] Supabase QA synthetic fixture used for initial API concurrency check was removed after verifying counts; `0` auth users, owners, members, cards, reissues and audit rows.
- [x] Card-origin code now recognizes *exact* feature QA branch alias, preserving the production/main Preview origin and strict QR host allowlist.
- [!] Vercel unyil project `mas` has no linked Git repository (`link:null`); Vercel rejected branch-scoped QA environment variables with `Branch ... not found in connected Git repository`. No variables were applied; existing Preview still uses its unchanged settings.
- [ ] Owner QA Auth identity must be provisioned via supported Supabase Auth admin flow (not raw manual `auth.users` password edits), with unique QA-only credentials and key.
- [ ] Dedicated isolated Vercel QA project or safely linked branch-specific Preview must be configured, protected by Vercel Auth, using **only** `tnadzytuamdxfypoeggy`; user approval required for any new Vercel project.
- [ ] Authenticated cross-page browser UAT and production release sign-off.
Evidence: `docs/2026-10-17-stage5-concurrency-preview-blocker.md`.

### Stage 5 update — Existing Preview QA branch isolation RESOLVED (2026-10-17 WIB)

- [x] User confirmed: **use existing Vercel Preview**, no new project.
- [x] Confirmed existing Vercel `mas` project is linked to `unyilhm1-hue/mas`, not the application code repo `warasjawa-laundry/Mas`.
- [x] Created **branch name only** `feature/admin-operations-reliability-20261017` from the existing commit of linked repository `unyilhm1-hue/mas`; no source or `main` changes there.
- [x] Created 8 Preview-only environment variables scoped to that branch. Supabase URL, publishable key and distinct AES key belong to QA `tnadzytuamdxfypoeggy`. No global Preview or production variable overwritten. Feature flags remain `0`.
- [x] Implemented `assertQaPreviewIsolation()` before Auth, scan progress, and card encryption operations. Feature branch fails closed if it inherits shared Preview (possibly customer-connected) settings.
- [x] Added `tests/qa-preview-isolation.test.mjs` with negative and positive cases. QR generation already points feature QA cards to feature-specific alias.
- [ ] Run all CI checks on the guard+docs candidate and deploy only the exact passing SHA to same existing Vercel Preview alias; verify `bom1`, branch and environment isolation.
- [ ] Create a genuine Auth user in **Supabase QA** using the official Auth admin UI/API, not direct SQL password mutation. Set the QA-only email to match `OWNER_AUTH_EMAIL` scoped variable; activate QA owner row separately.
- [ ] Authenticated QA browser E2E (login → member → QR → transaction/point → void/promo). Do not run against customer preview/main.
- [ ] Obtain explicit authorization for any customer SQL migration, feature activation or production publication.

Details: `docs/2026-10-17-stage5-preview-qa-isolation-checkpoint.md`.

### Stage 5 — QA Preview deployment READY; UAT gate pending (2026-10-17)

## Deployment certification checkpoint — 2026-10-17
- [x] Six PR #12 GitHub Actions workflows **SUCCESS** for exact deployment source SHA `6bb3d436f7d98ab717f8d6822b9bbf54d1081c65`.
- [x] Manual existing-project Preview deployment `dpl_A9vYE1PD5wNKTNH4iQ1Eym829zNu` **READY** with functions in Mumbai `bom1`.
- [x] Verified source Git branch `feature/admin-operations-reliability-20261017`, SHA `6bb3d43`, and stable QA alias `https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app`.
- [x] Verified main Preview alias still points to `dpl_3qF3NBniMjH9ka1LCY9jAFuJyM2z`, not the QA deployment; main shared Preview configuration untouched.
- [x] QA Supabase remains empty of auth users, owners, members and cards; original two seed year rules remain.
- [ ] **Runtime isolation attestation**: after signing into Vercel team session, open `https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app/api/qa-readiness`; must return HTTP 200 `{"qaPreviewIsolation":"configured"}`. External unauthenticated retrieval is blocked by Vercel protection and cannot be treated as verified.
- [ ] Provision a real QA Auth owner in Supabase `tnadzytuamdxfypoeggy` via supported Auth management, set matching branch-only email and owner account row, then authenticated browser UAT.
- [ ] QA feature flags remain OFF; source guard in draft PR #12 is not merged to production `main`. No production DB migrations executed.

**Important:** READY/6 green CI workflows validate the deployment, not a successful authenticated browser transaction. Never test against the Vercel main alias or production database.

### Stage 5 checkpoint — screenshot confirms QA runtime configuration (2026-10-17)

- [x] User opened protected Vercel branch QA readiness endpoint and shared screenshot showing `{"qaPreviewIsolation":"configured"}`.
- [x] Branch runtime isolation check recognized expected QA project URL and marker. This does **not** certify Supabase Auth credentials, database operations or browser UAT.
- [x] Isolated QA database remains free of Auth users, owner grants and member records on read-only inspection.
- [x] QA Auth enrollment procedure and outstanding gate recorded in `docs/2026-10-17-stage5-preview-qa-isolation-checkpoint.md`.
- [ ] Create real QA-only Auth user with controlled email through Supabase Authentication dashboard; do not share password.
- [ ] Set QA branch email, grant only that user owner status in QA, redeploy branch and complete Auth/transaction UAT.
- [ ] Keep customer database and official hosting unchanged; do not merge QA guard PR #12 until browser UAT is certified.
