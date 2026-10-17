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

## Readiness route and PR (latest checkpoint)
- [x] Opened draft PR [#12](https://github.com/warasjawa-laundry/Mas/pull/12) for QA-only runtime guard; **not merged**.
- [x] Added `GET /api/qa-readiness` on the feature branch. It returns HTTP `200` with `qaPreviewIsolation:"configured"` when the exact QA marker, URL and key are present; HTTP `503` and `"blocked"` if the settings do not match; HTTP `404` outside the QA preview branch. No credentials, tokens, account info or customer data are returned, and response caching is disabled.
- [x] Added static regression coverage for preview-only handling and failure responses.
- [ ] Verify the route against the *new* Vercel branch Preview via an authenticated Vercel team session, confirming `200 configured` before any owner login/transaction test.
- [ ] Obtain genuine QA Supabase Auth account and map its UUID to `laundry_owner_accounts`; placeholder QA `OWNER_AUTH_EMAIL` must be replaced with the matching account email without changing shared Preview config.
- [ ] Activate flags for **QA branch only** after owner browser UAT and explicit test readiness, not on customer hosting.

## Deployment certification checkpoint — 2026-10-17
- [x] Six PR #12 GitHub Actions workflows **SUCCESS** for exact deployment source SHA `6bb3d436f7d98ab717f8d6822b9bbf54d1081c65`.
- [x] Manual existing-project Preview deployment `dpl_A9vYE1PD5wNKTNH4iQ1Eym829zNu` **READY** with functions in Mumbai `bom1`.
- [x] Verified source Git branch `feature/admin-operations-reliability-20261017`, SHA `6bb3d43`, and stable QA alias `https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app`.
- [x] Verified main Preview alias still points to `dpl_3qF3NBniMjH9ka1LCY9jAFuJyM2z`, not the QA deployment; main shared Preview configuration untouched.
- [x] QA Supabase remains empty of auth users, owners, members and cards; original two seed year rules remain.
- [x] **QA runtime configuration attestation (user-verified)**: screenshot from authenticated browser shows `{"qaPreviewIsolation":"configured"}` at the protected Preview QA readiness page. The content proves that the guard accepted the QA branch marker, exact Supabase QA URL and a non-empty publishable key at runtime. Screenshot does not expose HTTP status directly and the endpoint does **not** validate an actual database connection or credentials.
- [ ] Provision a real QA Auth owner in Supabase `tnadzytuamdxfypoeggy` via supported Auth management, set matching branch-only email and owner account row, then authenticated browser UAT.
- [ ] QA feature flags remain OFF; source guard in draft PR #12 is not merged to production `main`. No production DB migrations executed.

**Important:** READY/6 green CI workflows validate the deployment, not a successful authenticated browser transaction. Never test against the Vercel main alias or production database.

## 2026-10-17 user verification & next gate

- [x] Owner supplied a screenshot of the branch QA readiness endpoint displaying exactly `{"qaPreviewIsolation":"configured"}`. The screenshot is evidence shared in the conversation, not a file copied into this repository.
- [x] QA schema read-only inspection: `auth.users=0`, `laundry_owner_accounts=0`, `laundry_members=0`. No production customer identities were copied.
- [x] Owner table shape checked: `auth_user_id uuid`, `is_active boolean`, `created_at timestamptz`, `created_note text`.
- [ ] Create one real QA Auth user using Supabase Auth administration; use an email controlled by the tester. Do not submit the QA password to GitHub, ChatGPT messages, or Vercel environment values.
- [ ] Set branch-specific `OWNER_AUTH_EMAIL` equal to the QA Auth email and keep `OWNER_LOGIN_ID` configured for tester login.
- [ ] Insert one matching active owner row **only** in `tnadzytuamdxfypoeggy`, referencing existing `auth.users.id`, after verifying the intended QA identity. No manually invented auth.users row/password.
- [ ] Redeploy the branch Preview after updating the email; perform actual Auth login and `requireOwner()` verification.
- [ ] Complete member/QR/transaction/void/promotions flow using synthetic QA member only, flags initially OFF; record timings and Vercel errors.
- [ ] Validate QA publishable key and real database RPC through the browser application; readiness JSON alone does not prove connectivity.

**Release status:** PR #12 remains DRAFT. No production schema deployment or activation.
