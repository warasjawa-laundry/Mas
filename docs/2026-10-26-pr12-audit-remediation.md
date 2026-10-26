# PR 12 audit remediation, 26 October 2026

The admin grant validator now rejects non-base64url signatures before comparing byte buffers. A regression using multibyte signatures failed with ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH before the fix and passes afterward. Valid grants remain subject-bound and retain their existing expiry behavior.

Stage 20 adds the two card-reissue foreign-key indexes that Stage 15 could skip when applied before the reissue table existed. It is additive and retry-safe. Both databases now have the indexes; performance advisors no longer report unindexed foreign keys. All 15 migration bodies were checksum-verified before their recorded versions were reconciled to repository filenames. No migration body was replayed during reconciliation.

Local verification: 131 Node tests, TypeScript, production build and 65 browser tests pass. Browser tests use the existing isolated component/unauthenticated suite; they do not establish authenticated operational acceptance. No merge, application deployment or DNS change is included.

## Customer consolidation checkpoint

Both Supabase projects already run in Mumbai (ap-south-1). The operational project remains the intended consolidation destination. A read-only comparison and private application-table snapshots were taken before changing index/history metadata; contacts, snapshots and generated merge SQL must never be committed to this public repository.

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

Consolidation has not been applied. QA and operational cards use separate AES keys, and existing QA QR URLs point to the QA preview alias. Moving ciphertext without validating and re-encrypting it under the operational key would break reprints. Retiring QA before updating the preview configuration would also break issued links. The connected Vercel identity currently has access only to KingdomHub, while the laundry project belongs to m8traders-projects-081d9dc2; project inspection returns 403 and team authorization returns 404. Correct team access is required before the key/link migration and application cutover. Never paste encryption keys in chat or rotate the operational key as a shortcut.

Leaked-password protection remains the previously paused provider setting. Authenticated acceptance and the final Supabase retirement require their own verification after the consolidation dependencies are resolved. Keep QA active until those checks pass.
