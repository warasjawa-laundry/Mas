# Stage 1 — QR Origin and Parser Checkpoint
**Status:** implementation and GitHub tests PASS, authenticated visual UAT PENDING. **Candidate:** `4729a62`.

## Changes
- `lib/laundry/card-origins.ts`: stable Preview alias + official domain, localhost only for local dev.
- `lib/laundry/card.ts`: use approved origin rather than `VERCEL_URL` immutable hostname.
- `lib/laundry/scan.ts`: allow exact stable origin + tightly scoped historical Vercel hosts; continue forbidding http/untrusted domains, query fragments, credentials, and non-card paths.
- `tests/qr-canonical-links.test.mjs`: executable allow/deny cases. Existing source-contract assertion updated for constant extraction.

## Checklist
- [x] Stable Preview origin in code
- [x] Production and local origins explicit
- [x] Legacy QR extraction supported
- [x] Hostile URL parsing regression tests
- [x] CI 6/6 PASS on `4729a62`
- [ ] Scan physically printed review QR with camera + gallery (test member only)
- [ ] Verify customer public progress route uses review alias with protection and matching database
- [ ] Verify released official domain hosts `/k/<token>` before printing customer cards

**Warning:** Old one-off QA URLs still point to their original deployments when opened outside the app. Scanner extraction is local and safe; cards should be reprinted on stable origin after launch.
