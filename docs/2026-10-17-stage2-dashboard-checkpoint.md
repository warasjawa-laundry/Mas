# Stage 2 — Operational Dashboard Checkpoint
**Status:** implementation and GitHub tests PASS, authenticated mobile/desktop UAT PENDING. **Candidate:** `4729a62`.

## Changes
- Owner-only `/admin` with minimal count queries; scan-first; direct member, enrollment, points and settings links.
- Shared `AdminNavigation` in admin layout: desktop sidebar and 4-entry bottom navigation on mobile; logged-out login page does not render it.
- Login redirect updated to `/admin`, without weakening `requireOwner` or RLS.
- CSS in `app/admin/admin.css` with responsive page insets and focus-visible styles. Source contract tests in `tests/admin-operations.test.mjs`.

## Checklist
- [x] Owner checks on dashboard; no extra auth query in shell
- [x] Shared navigation, active section and protected actions
- [x] Mobile nav, desktop layout, keyboard skip and focus styles in code
- [x] CI 6/6 PASS on `4729a62`
- [ ] Playwright authenticated screenshot 320/360/390/768/1440 pixels
- [ ] Test logout and browser back navigation after logout
- [ ] Compare dashboard response time and request totals against previous `/admin/scan`

**No production deployment.**

## Post-checkpoint Preview navigation fix

- Corrected `lib/navigation.ts` so the stable review-main redirect is only active for Vercel Preview builds sourced from `main`. Feature-branch Preview navigation now remains on its own origin for proper UAT.
- `tests/preview-navigation.test.mjs` executes real link generation under main, feature, production, Netlify, and hostile origin conditions.
- CI: 6/6 PASS at code commit `7f89d31`.
