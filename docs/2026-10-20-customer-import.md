# Customer import, 20 October 2026

The owner authorized importing the supplied customer workbook into both the isolated QA project and the operational database. This does not authorize merging main, changing DNS, or deploying the production application.

## Mapping and safeguards

- 776 source customers. Whitespace in names is normalized; duplicate names remain separate records when their phones differ. Different names sharing a phone also remain separate.
- Match an existing member only when both normalized name and normalized phone match exactly. Six QA members match; no operational members match. Preserve their IDs, member numbers, cards, consent, transactions, points and promos. Fill only an absent address.
- Eight empty addresses remain SQL NULL. Other addresses are stored verbatim after trimming outside whitespace, accessible only to the owner under member RLS.
- 23 phones fail the application's existing phone validator. Import these customers with a NULL WhatsApp field and retain the original number in the owner-only import provenance table for correction. No phone digits are guessed.
- All new members have promotional consent false. The workbook contains no transactions, point awards or consent evidence.
- File SHA-256 plus source row uniquely identifies an import record. Deterministic registration request UUIDs, an atomic transaction and table locks prevent duplicate ingestion and concurrent matching changes. Replaying the same import is a no-op.
- The import generator defaults to rollback. Review its summary before generating commit mode. Inputs and generated SQL contain private contact data and must stay outside git and public artifacts.

## Cards

Imported members receive their system-assigned member number immediately. An authenticated active owner opens Kartu QR and chooses Terbitkan Kartu for initial issuance. Token generation and AES-GCM encryption run on the application server using the existing key. Import tooling never reads or rotates encryption keys.

The initial-card RPC requires an imported, active member and an active owner. A member row lock makes retries return an existing active card without replacing it. Previously revoked cards cannot use this path to bypass reissue policy. Existing cards keep the original print flow without additional import queries. Public QR functions do not return source phones or addresses.

## Validation

Both target databases passed a full import dry run with rollback: 776 associations each, 770 new / 6 existing QA, and 776 new operational. The synthetic rollback SQL suite checks owner/nonowner/anonymous/inactive access, source replay uniqueness, same-name members, NULL address/phone preservation, initial issuance retries, malformed card material and revoked-card refusal. Local render tests verify missing-card, existing-card, load-error and inactive-member paths. Build, typecheck and the existing regression suite are required before publishing QA.

Database identity sequences can advance during rolled-back dry runs. Member numbers remain unique; gaps are expected and are never reassigned.

Operational UI deployment is separate from this import. The initial-card UI is released to the QA branch first; no production application merge is part of this task.
