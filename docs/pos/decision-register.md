# POS decisions and implementation ledger

## User decisions

On 1 November 2026 the user explicitly selected “Setujui usulan D01–D11 untuk implementasi” after receiving the summary of DP, full-payment points, final-price basis including fees, WIB year, no backfill, full-refund-first, restricted custom discounts, manual WA and online-only. See `implementation-plan-v2.md` section 10 for the full approved decisions. This authorizes implementation, not production cutover.

The user separately approved a clean Mumbai QA project in organization `irwtmqbaqcnbxuuyamvk` at the tool quote US$0/month. Old paused QA remains untouched.

## Implementation rulings

- Pure money calculation is implemented before the order wizard as an independently testable approved contract; no financial writes depend on client totals. Wrong assumptions cost a contract/test revision before DB/UI integration.
- Amount/line/subtotal/fees/final caps are Rp1 billion. A later discount does not rescue an overflowing subtotal. Quantities are capped at one million units per line, with at most 1,000 lines, to bound parsing/calculation. These technical limits are documented and tested; changing them needs synchronized DB validation.
- Unknown item/adjustment/discount fields are rejected rather than silently ignored; a misspelled fee must not produce a successful lower quote.
- New QA reconstructs only schema, migration seeds and rollback fixtures, not real customer rows or private consolidation payloads.
- No global Preview env overwrite, new Vercel project or production release is used to work around a wrong Git connection. The G1 cloud gate remains pending until the existing project link is repaired.

## Task status

| Task | Status |
| --- | --- |
| G0 source/data baseline | Read-only snapshot, source pin, schema/RPC inventory complete; reference screenshots/Excel and backup/restore evidence still pending |
| G1 QA schema/code isolation | QA created, 17 migrations reconstructed, 8 SQL tests pass, code boundary hardening implemented; protected Preview configuration/UAT blocked by Git link |
| Nominal contract for G2/G4 | BigInt utility implemented; focused red/green tests and independent review completed |
| G2 RBAC/financial schema and legacy bridge | Not implemented; actor FK constraint issue must be resolved in reviewed migration design |
| G3–G8 | Not implemented; retain dependency gates |

## Newly verified G2 design issue

The legacy checklist and audit event `actor_id` foreign keys point to `laundry_owner_accounts`. A cashier cannot insert a correctly attributed point event merely because a new POS helper accepts that cashier. Adding cashiers as active owners would be an unacceptable privilege escalation.

Before writing the bridge migration, review an explicit compatibility change: point/audit actor references may need to target canonical `auth.users` while owner-only RPC authorization, base-table grants and RLS remain unchanged. Existing historical rows must not be rewritten and actor identities must not be fabricated. Member/card/promo owner-only constraints should remain unchanged unless separately required. This is a constraint change, not something to describe as “only adding new tables.” Add direct privilege, cashier attribution, owner regression and historical-FK tests before accepting it. No such migration has been applied to production or QA in this foundation patch.
