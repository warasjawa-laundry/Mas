# Stage 4 — Card Reissue & Yearly Points Implementation Checkpoint

**Date:** 2026-10-17 WIB  
**Branch:** `feature/admin-operations-reliability-20261017`  
**Status:** SOURCE CODE IMPLEMENTED; DATABASE QA + AUTHENTICATED UAT PENDING. **Stage 4 NOT fully certified.**  
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

- [ ] Confirm creation organization (one visible: `warasjawa-laundry's Org`) and any nonzero quoted cost **before** provisioning Supabase QA.
- [ ] Create **isolated** Supabase QA project in Mumbai (`ap-south-1`); never copy customer records or production credential values.
- [ ] Apply original repository migrations in order to QA, then Stage 10 SQL. Confirm owner privileges, no public journal grants and RLS.
- [ ] Create isolated synthetic QA owner/member/QR fixture. Test initial card, reissue, old token rejection, new token acceptance, preserved counts/promos/points, concurrent attempts and duplicate UUID across actors/members; roll back fixture where possible.
- [ ] Prove no extra card on a retry with same UUID; check active card partial unique index and audit. Test bad digest, reason, inactive member, anonymous requester.
- [ ] Exercise points next-year initialization, concurrent duplicate setup, revision/tiers, invalid year and historical isolation. WIB rollover logic is unit-tested, but DB boundary behavior needs QA fixtures or controlled time simulation.
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
