# Binatu admin/POS UI implementation receipt

2 November 2026. Base: main `a9376b7` (PR28). Scope: [approved UI scope](./binatu-ui-scope.md).

## Implemented

- Replaced mixed owner/cashier navigation with a shared outlet sidebar and mobile Pesanan/Menu navigation; added protected menu pages. Role actions remain the original owner/cashier actions.
- Rebuilt owner/cashier login, real-data board with search and desktop note summary, customer directory/profile/create/edit, account and staff screens. Cashier service selection/summary, duration sheet, detail/payment, cash/report and manual WA use reference colors, typography and composition.
- Supplied laundry pattern, mark, storefront and empty-state art are reused as local SVGs. Plus Jakarta Sans is self-hosted with its OFL. No CDN runtime or reference demo toolbar/contact data is introduced.
- Scan, promo, points and catalog-price controls are omitted from new navigation/default profiles/wizard. Protected legacy routes and backend implementations remain. Registration continues to issue its existing card; editing contact information retains backend KEEP/revocation semantics.
- Fixed mobile progression: duration can advance before a quote exists; services have a confirmation action. Quantity controls preserve thousandth precision using BigInt. Submission retains real request IDs, item revisions, validation and write locks.
- Read failures do not display verified zero balances/orders. Search explicitly covers at most the 80 latest notes returned by the unchanged RPC. The owner home does not acquire a cashier session or fabricate owner POS reads; it directs note creation/access to cashier login.

## Verification performed

- Baseline: 238 Node tests passed. Final: **255 passed, 0 failed** (`npm test`).
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0, production build and all routes generated.
- `git diff --check`: exit 0.
- Independent review found three P2 issues, fixed and re-reviewed: legacy transaction-result redirects, staff page old palette, bounded-search disclosure. No outstanding P1/P2 in reviewed source. Supplemental print/WA/import styling reviewed separately.
- HTTP smoke against standalone production build: login pages, protected menus redirecting to login, reference SVGs and local font all returned expected successful responses. This did not log in or call a database.
- New tests cover real static component rendering, escaped customer/catalog text, unavailable data, retained form/action/payloads, staff permissions, disabled financial submit, exact fractional stepping, step progression and actual legacy redirect-query recovery.
- Existing browser specs were aligned with approved Manajer/customer navigation. They were **not run locally**, because local browser access is disabled in Work. The repository CI runs them on GitHub's hosted runner.
- First hosted CI run: six workflows passed. The two full-browser workflows each passed 75/78 tests; their only three failures expected the old purple password focus ring at 320/390/1440px, while the new dark ring rendered correctly. Updated that expectation to the approved dark palette and explicitly asserted the retained 3px solid focus indicator; hosted CI is rerun on the follow-up commit.

## Backend/data preservation

The final preservation query has no output:

```powershell
git diff a9376b7 --name-only -- supabase ':(glob)**/actions.ts' lib/supabase lib/pos/cashier-permissions.ts lib/pos/money.ts
```

No migrations, database mutations, credentials, environment variables, permission keys, financial calculations or transaction switches were changed. This task did not connect to operational Supabase. No production deployment/cutover was performed.

## Antislop gate status

Implementation remains a **review draft** until the visual gate can be completed. It is not a claim of pixel parity or completed real-device UAT.

| Gate | Status and evidence |
| --- | --- |
| Direction / R-37 | PASS: user explicitly selected the supplied HTML; ENERGY 2 / RHYTHM 2 / MOTION 1 recorded in scope |
| Purpose / identity | PASS at source review: yellow primary/selected actions, laundry motif and supplied art; no generic glyph decoration or generated marketing sections |
| Truthfulness / C-5 | PASS at source/tests: real rows/counts only; unavailable state and 80-note search bound; no false WA delivery or demo seed |
| Function/data contracts | PASS at source/tests: 255 tests, auth/actions/SQL unchanged; frontend step and quantity regression tests |
| Contrast | PASS for measured active text/control pairs: dark/yellow, muted/white, error/success, input borders and focus; calculations in task reports. Not an exhaustive rendered-state visual claim |
| R-03 / R-32 / R-35, visual craftsmanship | PENDING: browser reports `Local browser use is disabled in Work settings`; mobile/tablet/desktop screenshots, zoom, full keyboard/click-through and physical printing remain unverified |

Do not mark the visual Delivery Gate PASS or promote this draft based solely on Node/build/CI success. Hardware camera and print acceptance remain separate from UI source implementation.
