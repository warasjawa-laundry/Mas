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
- [x] Source-contract tests and Playwright mobile tests added (open menu at bottom → click Member → land at top, menu closed, actions visible, anchors reach correct destinations). Initial CI reproduced the old retained-scroll bug and located a stale test expecting the admin link at the bottom. Both are corrected and rerun PASS.
- [x] All 7 GitHub CI workflows PASS on source SHA `52c7f00b2b91a729287a343016936922ba8c301e`, including mobile Playwright navigation and integration CI.
- [x] Deployed exact source SHA to existing protected Vercel QA Preview, deployment `dpl_8Xej8XTcYd5XsRavkVK99rd6n1MR` **READY**, function region Mumbai (`bom1`); QA alias points to that deployment. Preview `main` alias unchanged at `dpl_3qF3NBniMjH9ka1LCY9jAFuJyM2z`.
- [ ] Manual Android mobile test with saved old scroll position and menu opened, plus member QR and admin password entry.
- [ ] Production/main deployment unchanged; no database migrations.

## Safety boundary
Native navigation to the public member page resets document scroll without changing Supabase Auth or point policies. The admin shortcut always navigates to the existing `/admin/login` and requires password; public QR scans never create transactions.

## Post-fix evidence and safety
- [x] Added `components/membership-scroll-entry.tsx`: deterministic instant scroll reset on entry, next-frame layout, and browser `pageshow`; an explicit `#scan-kartu` hash is respected.
- [x] Updated historical `tests/public-member-entry.ui.spec.ts` to locate the new top-of-page admin action.
- [x] Removed obsolete lower admin-link CSS. Customer scanner, QR token validation and existing login rules untouched.
- [x] CI 7/7 PASS at SHA `52c7f00b2b91a729287a343016936922ba8c301e`; QA deployment `dpl_8Xej8XTcYd5XsRavkVK99rd6n1MR` READY in `bom1`.
- [ ] User Android visual check after refreshing the protected QA Preview, particularly from a homepage that was previously scrolled to the bottom.

**No database, production site, DNS, or customer session mutation.** Remains on draft PR #12.
