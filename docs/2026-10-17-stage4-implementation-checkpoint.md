# Stage 4 — Card Reissue & Yearly Points Implementation Checkpoint

**Date:** 2026-10-17 WIB  
**Branch:** `feature/admin-operations-reliability-20261017`  
**Status:** SOURCE CODE IMPLEMENTED (6/6 CI PASS on code SHA `0798e10`); ISOLATED DATABASE QA SQL PASS; CONCURRENCY + AUTHENTICATED UAT PENDING. **Stage 4 NOT fully certified.**  
**PR:** https://github.com/warasjawa-laundry/Mas/pull/11

## Completed source work

- [x] Added QA-gated migration `supabase/migrations/20261017090000_stage10_card_reissue_and_next_year.sql`.
- [x] Owner-only card-reissue RPC validates active owner, member and request, locks member row, revokes old card and inserts new card atomically. Dedicated audit journal and idempotency UUID. Existing one-active-card partial unique index remains authoritative.
- [x] Added server action `app/admin/members/card/actions.ts` and a carefully worded lost-card form in `app/admin/members/[id]/card/page.tsx`.
- [x] `OWNER_CARD_REISSUE_ENABLED` defaults disabled; no production link, migration or existing card is altered automatically.
- [x] Added `laundry_initialize_point_year` database RPC, copying previous-year thresholds once, without touching prior ledgers.
- [x] `lib/laundry/program-years.ts` calculates current/next year in WIB; `app/admin/points/actions.ts` and `app/admin/points/rules/page.tsx` support dynamic year tabs and explicit year initialization.
- [x] `OWNER_POINT_YEAR_SETUP_ENABLED` defaults disabled pending migrated QA environment.
- [x] Owner member detail and customer QR progress display current-year points separately from historical years and 2026 trial.
- [x] Added executable WIB date boundary tests and source-level migration security contracts in `tests/stage10-contract.test.mjs`.
- [x] Corrected an early JSX syntax issue caught by TypeScript CI; no defect hidden or ignored.

## Required next gates

- [x] Approved organization `warasjawa-laundry's Org`; project `tnadzytuamdxfypoeggy` created in Mumbai, quote US$0/month.
- [x] Isolated Supabase QA project created and verified ACTIVE_HEALTHY; no customer records or production credentials copied.
- [x] Exact recovered Stage 3 original DDL plus Stage 4–10 applied in chronological order (8/8). Ten business tables RLS enabled; anon cannot execute owner RPC or read the audit table.
- [x] Rollback-only QA synthetic owner/member/card tests: old/new token, replacement, request idempotency, conflicting actor/reason, absence of leakage; no fixtures persisted.
- [ ] Extend integration to two independent concurrent sessions and populated QA histories to verify preserved visits/promos/points under real race conditions.
- [x] Proved no extra active card or audit on same-UUID retry, conflicting reason/actor denied, anonymous denied, via QA SQL test.
- [ ] Add dedicated SQL cases for malformed digest, inactive members and concurrent double-submit.
- [x] Tested 2027 setup, duplicate setup, copying tiers from 2026, refusal of 2028 while in 2026; WIB rollover tested via JS unit tests.
- [ ] Real multi-session simultaneous setup, rule revision conflict and future WIB-year DB behavior need further QA.
- [ ] Point **isolated Preview**, not public/production, at QA; enable the two server flags **only** there and run authenticated owner browser UAT.
- [ ] Re-run CI, migrations/parity and QA security/performance advisors after the database change. Validate preview console/network latency and no QR bearer leakage.
- [ ] Obtain separate promotion approval; DO NOT deploy Stage 10 SQL to customer Supabase or release to `main` until signed off.

## Safety decisions

1. Auth gate and owner role live check remain in server actions; PostgreSQL `auth.uid()` and active owner row checks remain inside private definer functions. Public wrappers are `security invoker`.
2. Form never exposes database credentials, token digests or encryption keys. QR token exists only in owner-generated encryption and printed/private customer URL.
3. Idempotent reissues return the first issued card ID for the same owner, member, reason and request UUID. Reuse against other identities or reasons fails closed.
4. Production Vercel/Netlify, DNS, `main`, and all customer member records (including Kiki) remain unchanged.
5. A green source test/build does not prove database SQL functionality or authenticated mobile usability.

## Reference deployment boundary

The **older** branch Preview `dpl_9g7wikotpv1VYT9ZGzTwnuPdKCKA` in `bom1` is pre-Stage-4 and remains the only manually deployed branch Preview. New Stage-4 code has not been enabled or deployed there.

## GitHub certification of code-only implementation
- Six workflow runs successful on commit `0798e10e2613500f3ecded78764f2e461984dfc9`: Stage 2 Public Site, Stage 3 Owner Auth, Stage 4 Member/QR, Stage 5 Owner Checklist/Scan, Stage 6 Manual Promotions, Mas Jawa Laundry Integration CI.
- This green result covers source/unit contracts, TypeScript and Next.js build plus unauthenticated browser fixtures, **not** running Stage 10 migration in PostgreSQL or actual owner-card replacement in Preview.
- Documentation update itself is a subsequent commit and may generate another CI run.

## Verified isolated SQL QA outcome
- QA project: `tnadzytuamdxfypoeggy`, region `ap-south-1`; production still `hncfyfvqtlnvqyfrydzb`.
- Eight migrations applied and listed by Supabase; foundational SQL sources checked into this branch.
- PostgreSQL integration + role/RLS tests both PASS via `BEGIN; DO...; ROLLBACK`. No fixtures remain; 0 auth users, owners, members, cards, reissues.
- Next steps and advisor findings: `docs/2026-10-17-stage4-supabase-qa-checkpoint.md`.
- No manual Vercel Preview, Netlify, production SQL or `main` mutation occurred while provisioning and testing QA.

## SQL contention evidence (2026-10-17)
- [x] Added ephemeral PostgreSQL 17 GitHub Actions gate `Stage 10 PostgreSQL Concurrency QA`.
- [x] Two concurrent client connections serialize on the member lock: identical request UUID returns same card; one active card, one reissue journal row.
- [x] Two concurrent client connections initialize year 2027: exactly one row created; the other no-ops, source tiers preserved and no historic transaction backfill.
- [x] All 7 workflow checks green on exact code SHA `61957576a25fc73b34996e8c3017b4f47fc77a82`.
- [ ] QA-only browser login, protected Preview, and full owner workflow remain untested; Vercel branch env is blocked because project Git link is absent.
