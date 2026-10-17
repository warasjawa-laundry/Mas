# Stage 5 — Existing Vercel Preview QA Isolation Checkpoint
**Date:** 2026-10-17 WIB  
**Scope:** Existing Vercel project `mas` only; no new Vercel project, no changes to production Netlify or official domains.  
**Code branch:** `warasjawa-laundry/Mas:feature/admin-operations-reliability-20261017` after merge of PR #11.

## Completed

- [x] Verified PR #11 merged into code `main` at `f742b8ada74091672c882da2a0b4cf09ae20beb4`.
- [x] Verified Vercel project `mas` in `m8traders-projects-081d9dc2` has deployment protection enabled and functions deployed in `bom1`.
- [x] Identified project Git link points to `unyilhm1-hue/mas`, while authoritative Next.js source is `warasjawa-laundry/Mas`. Root cause of earlier branch variable API error.
- [x] Created branch name `feature/admin-operations-reliability-20261017` on `unyilhm1-hue/mas` from its existing initial commit for Vercel variable scoping **only**. No changes to its files or `main`.
- [x] Vercel accepted 8 branch-specific Preview environment values: `QA_BRANCH_ISOLATION`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LAUNDRY_CARD_ENCRYPTION_KEY`, `OWNER_AUTH_EMAIL`, `OWNER_LOGIN_ID`, `OWNER_CARD_REISSUE_ENABLED=0`, `OWNER_POINT_YEAR_SETUP_ENABLED=0`.
- [x] QA Supabase project ref must be `tnadzytuamdxfypoeggy`, URL `https://tnadzytuamdxfypoeggy.supabase.co`. Vercel branch settings use QA publishable key and newly generated QA-only AES key; neither appears in repository or documentation.
- [x] Verified **seven original shared Preview variables remain** and eight branch-scoped QA entries exist, without changing shared targets.
- [x] Added `lib/supabase/qa-preview-isolation.ts`, requiring exact QA branch, expected URL, project marker and key before access on that branch; invoked in Auth, proxy, public progress and QR encryption.
- [x] Added regression tests for missing branch override, mismatched customer URL, main preview unaffected, and guard wiring.

## Next gates

- [ ] GitHub CI 7/7 PASS for exact new code SHA.
- [ ] Manual Preview deployment of exact passing SHA on **same** Vercel project and branch alias, verify READY and `bom1`.
- [ ] Confirm feature branch actually receives QA vars at runtime; fail-closed guard prevents customer DB traffic if not.
- [ ] Provision independent QA Auth user using Supabase Auth admin interface/API, not raw SQL auth password edits. Only then insert active owner membership in QA, record process without secrets.
- [ ] Complete authenticated UAT in protected Preview and measure performance; validate scan does not create a transaction, point/void/progress and QR replacement, promo consent.
- [ ] Separate approval before enabling Stage 10 features on customer hosting, running Stage 10 against customer DB or production promotion.

## Safety limitations

The branch-scoped QA `OWNER_AUTH_EMAIL` is currently a placeholder, so **login cannot yet be UAT-certified**. Runtime isolation must be verified on the next fresh deployment; `READY` alone does not prove this. No customer data or credentials cloned to QA. Keep flags OFF until UAT fixtures and isolated Auth user are ready.

The existing old branch Preview is not automatically considered QA-safe merely because settings have been added. It must be redeployed and verified.

**Release:** CLOSED. PR #11 already merged; any follow-up QA-only guard must pass CI and review separately.
