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
1. Dedicated QA database and staged migration tests for card rotation and 2028+ rules: NOT DONE.
2. Authenticated business-flow E2E tests with QA fixtures: NOT DONE.
3. Feature QR points to reviewed main alias for stability; validate full public flow when matching main build is approved.
4. No merge or production promotion authorized at this checkpoint; custom domain, Netlify official site and ristkyx Vercel untouched.

**Next decision:** approve/provision isolated QA database or execute authenticated operator UAT on this safe Preview. No live DB changes should be performed by guesswork.
