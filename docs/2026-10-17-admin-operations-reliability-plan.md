# Mas Jawa Laundry — Operational Dashboard & Reliability Implementation Plan

**Date:** 2026-10-17 (WIB)  
**Branch:** `feature/admin-operations-reliability-20261017`  
**Base:** `50d9bd922c57448d5316a1584e6fc26b14a2e1eb` (PR #10)  
**Scope:** QR compatibility, owner dashboard/navigation, transaction UX, repeatable tests, security/performance reviews.  
**Status:** Stage 0–3 implementation COMPLETE (CI 6/6 PASS on candidate `4729a62`); Stage 4 schema GATED; Stage 5 authenticated Preview UAT PENDING. `main` and production unchanged.

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
