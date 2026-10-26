# PR 12 audit remediation, 26 October 2026

The admin grant validator now rejects non-base64url signatures before comparing byte buffers. A regression using multibyte signatures failed with ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH before the fix and passes afterward. Valid grants remain subject-bound and retain their existing expiry behavior.

Stage 20 adds the two card-reissue foreign-key indexes that Stage 15 could skip when applied before the reissue table existed. It is additive and retry-safe. Both databases now have the indexes; performance advisors no longer report unindexed foreign keys. All 16 migration bodies, including the administrator-only Stage 21 consolidation archive, were checksum-verified before their recorded versions were reconciled to repository filenames. No migration body was replayed during reconciliation.

Local verification: 134 Node tests, TypeScript, production build and 65 browser tests pass. Browser tests use the existing isolated component/unauthenticated suite; they do not establish authenticated operational acceptance. No merge, production deployment or DNS change is included. The Vercel Preview cutover is tracked separately in PR validation.

## Customer consolidation checkpoint

Both Supabase projects already run in Mumbai (ap-south-1). The operational project is the consolidation destination. Private application-table snapshots were taken before changes; contacts, snapshots and generated merge SQL must never be committed to this public repository. The following table records the pre-consolidation comparison.

| Data | Operational | QA |
| --- | ---: | ---: |
| Members | 777 | 784 |
| Imported source rows | 776 | 776 |
| Cards | 1 | 16 |
| Checklist events | 1 | 17 |
| Amount transactions | 0 | 16 |
| Promotions | 1 | 4 |
| Contact events | 0 | 7 |

All 776 source rows match by workbook hash and row number. Names match after case/whitespace normalization; phone, address and original source-phone values match. Six imported members differ in promotional consent. QA has eight members outside the import; matching a phone alone must not collapse differently named customers. Preserving these records gives an expected union of 785 members, subject to a final locked comparison before execution.

The owner confirmed that QA contains real data which must be preserved. Do not discard QA records as fixtures. Import-source matches must retain operational member identities; dependent QA cards, visits, point snapshots and promotions must be remapped consistently. Preserve consent evidence and source provenance, and do not recalculate historical awards from current point tiers.

Consolidation was dry-run with rollback, then committed after target locks and conflict checks. The destination now has 785 members, 17 cards, 18 checklist events, 16 amount transactions and five promotions. Six original consent grants were preserved with their timestamps and explicit contact events; all seven QA contact events were copied as well, giving 13 destination contact events. Original operational cards, visits and promotions were verified unchanged. Historical point awards, amounts, years and rule revisions were copied without recalculation.

Stage 21 stores the checksum-verified original QA application snapshot, including its complete audit history and original actor IDs, in an archive unavailable to anon, authenticated and service_role. It also records all 784 source-to-destination member mappings, including original member numbers. Operational IDs remain canonical for the 776 imported matches. Eight additional customers retain separate records, even where another person shares a phone. Source actor IDs are retained in the archive while live rows use the existing operational owner. Neither owner password is copied or reset.

All 17 active cards were tested under the anon role against the public RPCs: member identity, visit count, name and yearly balance availability matched. The source QA owner allowlist was frozen before the final comparison to prevent new writes during cutover. Do not reactivate the old writer after consolidation.

The user's unyilhm1 Vercel connection resolves the project under m8traders-projects-081d9dc2. Both existing encryption keys retain their original values. Vercel forbids renaming a Sensitive variable, so the former QA secret remains LAUNDRY_CARD_ENCRYPTION_KEY and is shared to Preview/Production. The unchanged operational key now has the explicit name LAUNDRY_CARD_ENCRYPTION_KEY_OPERATIONAL; it is preferred for new cards and admin signatures. Decryption falls back to the former QA key only when the explicit operational key is configured. The application does not expose either value. Existing deployments retain their baked configuration; do not deploy old source that lacks this key-selection logic.

LAUNDRY_DATABASE_MODE=single requires the exact operational Supabase URL and rejects a stale QA marker. The former QA branch's URL, public key and owner identity now point to operational settings; the readiness response distinguishes retired isolation from an isolated QA configuration. Preserve the stable preview alias for existing QA-issued QR links. Source pause must follow a READY replacement and HTTP verification of that alias; permanent deletion is not part of this checkpoint.

Leaked-password protection remains the previously paused provider setting. Successful owner login and physical card reprints still need user acceptance with the existing operational credentials. No synthetic customer transactions should be created in the consolidated operational database for CI.
