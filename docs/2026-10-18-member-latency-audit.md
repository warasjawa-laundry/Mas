# Member/admin/scan latency audit — 18 October 2026

## Evidence and scope

Inspected the existing QA Preview and its recent Vercel runtime timing logs, source dependencies, clean builds, and database request graph. The first log query exceeded Hobby retention; the corrected 30-minute query returned timings. No credentials or real card material were read for this audit. Logs were summarized without preserving member IDs.

The sampled server stages varied: member list data reads 43–329 ms; member detail reads 62–565 ms; live Auth checks 19–75 ms; owner-role checks 17–178 ms. These are stage samples across recent QA deployments, not end-to-end mobile timings or percentiles. They do not prove that every perceived delay comes from the database. Function startup, routing, JavaScript transfer, device work and mobile network latency can also contribute.

## Findings and corrections

1. Member detail rendered only one task, but still requested the ledger, its amount/cancellation metadata, promos, and point rules for every task. Catat transaksi now performs five data reads instead of up to nine when history contains ADD records. Promo also needs five. History retains its scoped metadata queries and skips promos/rules (up to seven reads). Independent reads remain parallel. Hidden data failures no longer delay unrelated tasks. Existing 25/30-row pagination and owner checks are retained.
2. Global CSS used a render-blocking Google Fonts import even though the current main layouts use system fonts. Removed the import and obsolete Outfit declarations. Operational pages no longer depend on Google font CSS/files. No font package was added.
3. Camera and gallery dynamically imported entire library entry points. They now load the QR-specific browser reader and the specific decode-hints module. QR code decoding remains deferred until a scan action. Clean builds of the baseline and candidate contain 21 versus 20 client JavaScript chunks, totaling 1,118,572 versus 1,101,332 raw bytes (331,813 versus 325,921 bytes when each file is gzip-compressed locally). This is a build inventory, not the bytes fetched on every page or a bandwidth benchmark.
4. Successful owner QR resolution cleared the loading flag before navigation unmounted the scanner, leaving an apparently idle screen that still held the scan lock. The busy state now remains visible and controls disabled while the member page opens. Invalid/error paths release it for retry. Added a fixed-label timing around the read-only owner card lookup to help isolate future delays; QR text and member data are never included in the timing label.

## Verification

- 116 Node regression tests and TypeScript pass. New execution tests forbid hidden promo/history/rule reads and enforce the transaction/promo query budget.
- Production build passes. Existing browser CI covers full screenshot/JPEG QR decoding, history, names, card print sizing, owner-only routes, and responsive layouts. Two additional browser cases verify no Google font requests on member entry/admin login.
- Live Auth validation, owner-role lookup, refresh/re-entry password requirement, RLS, private/no-store headers, scoring, transaction writes and QR revocation rules were not relaxed. No per-user response or authorization cache was added.
- No schema migration or customer-database mutation is needed. Changes belong to draft PR #12 and its isolated Vercel QA Preview. Physical Android timing, cold-start p95 and authenticated before/after load timings are not claimed.
