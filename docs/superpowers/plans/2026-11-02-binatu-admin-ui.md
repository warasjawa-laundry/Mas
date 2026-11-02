# Binatu Admin UI Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement and review tasks.

**Goal:** Replace mixed admin/POS visuals with supplied Binatu reference while preserving backend.
**Architecture:** Shared scoped design tokens/assets and navigation; real-data board; existing authorized form actions and RPC contracts. Separate UI tasks own disjoint files.
**Tech Stack:** Next.js 16, React 19, CSS/CSS modules, TypeScript, Node tests.
**Spec:** docs/pos/binatu-ui-scope.md

## Global Constraints
- Read scope before changes. No DB/SQL/backend/action changes; no transaction activation.
- Skip scan, promo, points and catalog-price UI; retain backend modules.
- Preserve latest main financial/security behavior. No demo data or fake success.
- Use reference yellow/motif/font and responsive HP/desktop compositions.
- Browser visual verification is blocked; record that gate honestly.

### Task 1: Shell, board and supplied assets
Files: components/admin/admin-navigation.tsx, components/pos/pos-board.tsx, components/pos/board-controls.tsx, app/pos-ui.css, public/pos/*, tests/binatu-board.test.mjs. Controller owns these.
- [ ] Extract reference assets; self-host supplied font; no new aesthetic.
- [ ] Create desktop sidebar/mobile Pesanan/Menu navigation with no deferred links.
- [ ] Replace mixed board with searchable real-order cards, master/detail desktop layout, honest empty/error states and role-appropriate menu. Preserve backend props/data.
- [ ] Verify renders, tabs, routes and source data escaping; no synthetic production metrics.

### Task 2: Admin legacy screens migrate to reference
Files exclusively: app/admin/admin.css, app/admin/login/page.tsx, app/admin/layout.tsx, app/admin/members/**/page.tsx, components/admin/member-directory-list.tsx, app/admin/settings/page.tsx, app/admin/loading.tsx, tests/binatu-admin.test.mjs.
- [ ] Read supplied HTML (login/menu/customer screens) and scope. All old admin screens adopt reference typography/colors/panels. CSS must preserve hidden legacy route usability/print without purple style bleed; no giant unrelated overrides.
- [ ] Login uses real existing owner/cashier actions, ID login contract and error messages. Use Manajer/Kasir labels, maintain inputs/IDs.
- [ ] Customer pages become customer directory/profile/create/edit with coherent reference header/list/forms. Default profile no scan/promo/points/legacy transaction UI; keep action/backend files and existing card issuance paths. New registration UI does not ask for promo consent. Deep promo/history routes may remain protected compatibility surfaces but not linked from new UI.
- [ ] Account settings excludes service-price links; staff management/account password remain available. Do not remove actions or auth checks.
- [ ] Add meaningful static-render tests for deferred links absent/profile safety and actions preserved. Run focused tests/typecheck; report changes and concerns. Do not commit other workers' files.

### Task 3: Cashier workspace/order UI
Files exclusively: app/kasir/pesanan/baru/order-form.tsx, wizard.module.css, duration-sheet.tsx, member-name-picker.tsx, app/kasir/pesanan/orders.module.css, app/kasir/pesanan/[id]/page.tsx, app/kasir/pesanan/baru/page.tsx, tests/binatu-order.test.mjs.
- [ ] Read supplied HTML mobile customer/duration/service/order/settings and desktop cashier screens plus scope. Rebuild wizard composition faithfully: step customer/duration then service list/quantity, bottom summary + real next action; desktop catalog + summary. Real catalog only.
- [ ] Remove scan UI import/mount from wizard, leave QR component/actions/backend untouched. Correct existing navigation defect where duration Continue depends on quote before services selected and service step lacks next control.
- [ ] Preserve form actions and payload fields, backend quote, write locks, member lookup and strict unit/precision. Quantity +/− must preserve fractional remainder, no float monetary math.
- [ ] Reference-style settings/confirmation with perfume/notes and honest unavailable fees/discounts, no false WA or mock data. Add keyboard-safe dialogs if used; no functional dead buttons.
- [ ] Restyle order details/payment/cash/report through shared CSS module without deleting actions/grants/idempotency/print/retry behavior. Hide points explanatory copy if necessary, don't alter backend points.
- [ ] Behavioral tests for step progression/quantity and source/render safety; focused tests/typecheck. Report; no other worker files.

### Task 4: Integration and review
- [ ] Review all diffs, update impacted old UI assertions to new explicitly approved navigation without weakening backend tests.
- [ ] Run full Node tests/typecheck/build and source rendering checks; no live financial writes.
- [ ] Independent whole-branch review, address findings. Record visual gate pending while browser disabled.
