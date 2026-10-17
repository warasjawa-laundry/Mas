# Stage 5 — PostgreSQL Concurrency PASS; QA Browser Isolation Blocker

**Date:** 2026-10-17 WIB  
**PR:** https://github.com/warasjawa-laundry/Mas/pull/11  
**Code HEAD tested:** `61957576a25fc73b34996e8c3017b4f47fc77a82`  
**Result:** 7/7 workflows SUCCESS. No merge, production deploy, or customer SQL.

## Automated two-connection concurrency result
- Workflow: `.github/workflows/stage10-postgres-concurrency.yml`, GitHub Actions run `39004521560`.
- A disposable PostgreSQL 17 service and Supabase Auth compatibility bootstrap are used. All eight original migrations are replayed in order.
- `supabase/tests/stage10-postgres-parallel-race.sh` creates two genuine overlapping `psql` TCP sessions.
- Same request UUID: both workers return the **same card UUID**, only one active replacement card and one reissue audit row.
- Initial creation of next year's points: exactly one worker inserts, the other returns no-op; five-tier thresholds equal prior-year rule and historical transactions remain untouched.
- Previous Supabase QA connector-side runs were serialized; **not** claimed as concurrent. The new PostgreSQL CI gate is the concurrency evidence.

## Supabase QA state after cleanup
- Name: `mas-jawa-laundry-qa`; ref `tnadzytuamdxfypoeggy`; Mumbai.
- All eight migrations installed, security roles and RLS verified on QA.
- Synthetic connector test fixture was removed with a guarded transaction; verified zero Auth user, owner, member, card, reissue, audit rows. Built-in point rules for 2026/2027 remain.
- No production data/credentials copied.

## Vercel QA isolation attempted — BLOCKED
- Existing unyil Vercel project: `mas` (ID `prj_XaFKO8opffvnhL9c0oE3GrGPt3H2`), with `link:null` in project detail.
- Attempt to create **branch-only** variables `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LAUNDRY_CARD_ENCRYPTION_KEY`, `OWNER_AUTH_EMAIL`, and disabled Stage 10 flags was rejected by Vercel API: **“Branch feature/admin-operations-reliability-20261017 not found in the connected Git repository.”**
- No environment variables changed. A randomly generated key for that rejected request was not stored or activated.
- Existing Preview URLs **must be treated as customer-DB-connected** unless isolation is independently verified. Do not use them for synthetic account creation or write UAT.
- `lib/laundry/card-origins.ts`, `card.ts`, `scan.ts` now recognize a distinct stable QA feature alias. Do not print/circulate QA cards until Preview isolation is established.

## Mandatory next actions
- [x] Independent parallel card and points concurrency tests.
- [x] All 7 CI workflows green for tested candidate SHA.
- [x] QA DB cleaned, default point-rule rows retained.
- [x] Documented provider blocker without overriding shared Preview variables.
- [ ] Obtain approval to create separate Vercel QA project **or** safely link existing project to Git while guaranteeing production/main Preview protection. Separate QA project is preferred.
- [ ] Bind only new QA Supabase publishable URL/key, fresh QA-only AES-256 encryption key, and QA-specific owner email; keep Stage 10 flags disabled until login/UAT is ready.
- [ ] Provision *real* QA Auth user via supported Supabase Auth admin console/API (not direct SQL modification of auth password/identities). Do not reuse owner production credentials or real customer records.
- [ ] Full positive owner login, QR camera/gallery, card reissue, transaction+point, void and promo UAT under QA; measure response times before/after with non-sensitive logs.
- [ ] Decide on merge/production migrations only after evidence and separate explicit release approval.

**Release gate: BLOCKED.** `main`, Netlify, official domains, and customer Supabase remain untouched.

## Later checkpoint — Blocker resolved for branch env configuration
The previously reported provider rejection has been resolved by creating a *branch name only* in the Vercel-connected `unyilhm1-hue/mas` repository. Vercel accepted branch-scoped QA variables, leaving common Preview and production variables unchanged. Runtime guard requires exact QA origin and marker before any Auth or card access. See `docs/2026-10-17-stage5-preview-qa-isolation-checkpoint.md`. Authenticated UAT and actual Preview runtime verification remain pending. This appendix supersedes the previous "provider blocker" status.
