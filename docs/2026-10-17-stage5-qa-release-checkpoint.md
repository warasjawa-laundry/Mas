# Stage 5 — QA and Release Checkpoint (2026-10-17)

**Status: PARTIAL — code/build gates PASS; authenticated UAT and DB-gated functionality PENDING.**

## Verified immutable candidate
- Source branch: `feature/admin-operations-reliability-20261017`
- Code SHA: `7f89d3107e07e4bcc092af8170ac4529545ab88f`
- CI: 6/6 GitHub Actions SUCCESS (Integration, Stage 2, Stage 3, Stage 4, Stage 5, Stage 6).
- Unyil Vercel project: `mas` (`prj_XaFKO8opffvnhL9c0oE3GrGPt3H2`).
- Manual Preview deployment: `dpl_9g7wikotpv1VYT9ZGzTwnuPdKCKA`.
- Build status: **READY**; Functions region: **Mumbai (`bom1`)**.
- Verified feature alias: `https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app` points to this deployment.
- Vercel has Deployment Protection enabled. Error monitor reported no clusters and runtime logs had no user requests; this does **not** establish successful logged-in transactions.

## Manual UAT (authorized owner on Preview only; do not test on Kiki)
- [ ] Sign in to the protected Preview and open `/admin/login`. Confirm successful login goes to `/admin`.
- [ ] Confirm desktop sidebar and mobile 4-item navigation (320, 360, 390, 768, 1440 px; Android Chrome).
- [ ] Scan a previously approved QA card with camera and with galeri photo; scan must *not* add a transaction.
- [ ] Verify member search, 25/page pagination, zero-results, previous/next and edit page.
- [ ] On an approved isolated QA member, submit nominal + description once; verify count +1 and awarded points per year.
- [ ] Retry same idempotency key and confirm no duplicate transaction.
- [ ] Void the test transaction with a reason; confirm count and points reconcile while historical entry remains.
- [ ] Verify manual promo and consent gating of editable WhatsApp draft; no automatic send.
- [ ] Confirm old/revoked QR cannot access public balance *after* QA card lifecycle migration is enabled.
- [ ] Capture response time per route from navigation tools and `[admin-perf]` timings; measure first visit and warm visit.
- [ ] Check Vercel server logs for errors AFTER a test request has actually run; preserve only non-sensitive timings.

## Release blockers
1. Dedicated QA database and migrations: **DONE** (QA project `tnadzytuamdxfypoeggy`); SQL functional/role checks and PostgreSQL 17 two-session concurrency PASS. Remaining UAT is independent of this SQL gate.
2. Authenticated business-flow E2E tests with QA fixtures: NOT DONE.
3. QA feature cards now use the fixed QA feature-branch alias (code only). This branch must never be deployed using customer-linked Preview variables; QA-only Vercel environment wiring remains blocked by missing linked Git repository.
4. No merge or production promotion authorized at this checkpoint; custom domain, Netlify official site and ristkyx Vercel untouched.

**Next decision:** provision a dedicated protected Vercel QA project with independent Supabase QA credentials, or safely connect the source repository to Vercel for branch-scoped variables. Current `mas` project has no Git link; provider rejected the attempted branch-scoped env settings. Do NOT change global Preview, run QA browser actions against customer DB, or enable Stage 10 flags until isolation is verified.

## Latest Preview isolation checkpoint
Existing unyil Vercel `mas` supports branch-specific QA variables after the linked repository's branch name was created. Eight branch-scoped variables have been configured, including QA-only Supabase, encryption material and flags OFF; no common Preview variables were changed. The application guard `assertQaPreviewIsolation()` throws if the feature-branch deployment attempts to use customer Supabase settings. CI, Preview redeploy and QA Auth-backed browser E2E are next. See `docs/2026-10-17-stage5-preview-qa-isolation-checkpoint.md`.
