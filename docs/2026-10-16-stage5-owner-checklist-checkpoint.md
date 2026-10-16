# Stage 5 — Owner Scan + Explicit Checklist Checkpoint (2026-10-16 WIB)

**Status:** backend migration applied; branch Preview implementation; automated CI passed on commit `f591b8c2`; current branch CI awaiting newest commit; production NOT changed.

## User contract
- On a successful QR camera scan, owner ONLY sees the matched member page. The scan does **not** add a transaction.
- Owner explicitly clicks **Catat 1 Transaksi** on the protected member page. One click = one ADD ledger event after an atomic server transaction.
- Request UUID is submitted as a hidden form field and the database enforces UNIQUE `request_id`. Repeated POSTs with the same request ID resolve to the same ADD rather than creating duplicate visits.
- Corrections append a VOID with a required reason (3–500 chars) and audit log; original event cannot be mutated or deleted. No automatic promo or checklist reset.
- Customer QR `/k/[token]` still shows only the effective (ADD - VOID) count and manually assigned available promos without a login.
- If camera access is unavailable, owner may search a member by name or paste the QR URL; no camera permission is required for manual mode.
- Public copy simplified: “Transaksi akan bertambah setelah dicatat oleh petugas laundry.”

## Implementation
- `/admin/scan`: modern mobile scanner, QR camera powered by `@zxing/browser@0.1.5`, explicit “Buka Kamera” action, stop/cleanup, manual fallback, no scan side effects.
- `/admin/members`: “Catat Transaksi” action on each member; `/admin/members/[id]`: protected count, +1 confirmation button, recent history, void-with-reason.
- `lib/laundry/scan.ts` extracts only valid 256-bit opaque tokens from own QR domain/allowed preview hosts. Does not fetch a scanned external URL.
- Owner actions verify Supabase Auth user and active allowlist. DB wrappers are `SECURITY INVOKER`, private SQL routines are `SECURITY DEFINER` in non-exposed schema with explicit auth.uid() owner check.
- Canonical source: `supabase/migrations/20261016180000_stage5_owner_checklist.sql`; migration deployed using Supabase integration as `stage5_owner_checklist`.
- All Stage 5 Vercel env vars scoped to branch Preview ONLY; the existing Stage 4 AES-256-GCM card encryption key was copied securely for QR reprint compatibility without revealing or committing it.
- Bootstrap workflow with contents:write was deleted after dependency lockfile was generated. Stage 5 CI regular workflow has contents:read.

## Verification
- [x] Earlier commit CI #38875648993 SUCCESS: npm ci, unit tests, TS, build, Chromium protected admin route checks and customer CSS viewport regression.
- [x] SQL rollback integration QA: owner can create QA member, ADD once, retry same request yields same event and count, VOID with reason yields 0, retry same VOID yields same event, audit rows created. All QA member/visit rows rolled back.
- [x] SQL privilege QA: direct anon EXECUTE=false for three new RPCs; authenticated EXECUTE=true but unauthorized Auth UUID denied by private owner check.
- [x] DB query after tests: 1 existing member, 0 checklist events, 0 promo rows, 2 historic audit rows from existing Stage 4 registration.
- [x] No production site merge or promotion; current production remains legacy `main`.
- [ ] CI and Vercel latest commit must finish and be confirmed.
- [ ] Positive real Android owner session test of camera permission, actual QR scan, and deliberate +1; then check customer page transitions 0 → 1. **Do not test +1 using a real customer without owner approval.**
- [ ] Manual accidental double-tap/retry and correction tests through UI; check count 1 → 0 after VOID.
- [ ] Device support testing: Android Chrome and in-app browser camera may differ; manual search is supported.
- [ ] Verify readable customer QR across preview host and official domain before printing/distribution; preview URLs are temporary.
- [ ] Rate limiting, abuse protections, visual/mobile/print accessibility, and owner content approvals before production.
- [ ] Supabase Auth leaked-password protection WARN remains to address.

**No actual customer visit transaction has been entered by the assistant.** This is a release-gated Preview feature, not a production release.
