# Stage 13 — Member Landing & Mobile Navigation Checkpoint
**Date:** 2026-10-17 WIB
**Scope:** Existing isolated QA Preview and draft PR #12. Public member-page navigation only.

## User report
On a phone, tapping "Kartu Member" from the homepage opens the membership page scrolled near the bottom, with the mobile menu still open. To scan a customer card or reach admin login, the user has to manually scroll up.

## Changes / checklist
- [x] Header (desktop and mobile), homepage member CTA, and footer use normal document navigation for `/membership` instead of Next client-side `Link` scroll restoration. Other public section navigation remains unchanged.
- [x] Put two concise, distinguishable actions immediately after the membership heading: **SUDAH JADI MEMBER → Scan QR Kartu** (in-page anchor), **KHUSUS PENGELOLA → Masuk Admin** (existing password login).
- [x] The scan heading, camera/gallery functionality and consent-safe public card flow are unchanged; `#scan-kartu` uses sticky-header scroll margin.
- [x] Remove lower redundant "Masuk ke pengelolaan kartu member" link, keeping one clear entry at top.
- [x] Responsive two-column action row at 375px mobile without horizontal overflow.
- [x] Source-contract tests and Playwright mobile tests added (open menu at bottom → click Member → land at top, menu closed, actions visible, anchors reach correct destinations).
- [ ] Full GitHub CI pass on exact source SHA.
- [ ] Deploy exact CI-passing SHA to protected Vercel QA Preview in Mumbai and verify alias.
- [ ] Manual Android mobile test with saved old scroll position and menu opened, plus member QR and admin password entry.
- [ ] Production/main deployment unchanged; no database migrations.

## Safety boundary
Native navigation to the public member page resets document scroll without changing Supabase Auth or point policies. The admin shortcut always navigates to the existing `/admin/login` and requires password; public QR scans never create transactions.
