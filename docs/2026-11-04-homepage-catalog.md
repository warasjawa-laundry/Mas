# Homepage and catalogue, 4 November 2026

Baseline main `32960bb42a74eded303e15959d51708910c1efd0`, including concurrent POS branding changes. PR #30 excluded. G8 remains NO_GO.

## Audit and fixes

| Finding | Resolution |
| --- | --- |
| Public reader ignored current package/family availability and numeric duration. | Scoped `laundry_public_service_catalog()` projects visible, available tariffs with active packages/families from the same POS source records. No public table grants. |
| Missing backend silently displayed eight legacy hardcoded rates. | Unavailable/503 instead of misleading fallback rates. Existing prices remain visibly marked if a later refresh fails; a genuine empty list is distinct. |
| Durations displayed in minutes. | Configured minutes divided by60, Indonesian hour formatting. Snapshot: Reguler72, Ekspres24, Kilat6 hours. Owner changes remain authoritative. Non-exact hundredths say Sekitar. |
| Category-first package cards made the phone list lengthy. | Explicit package buttons, one category column on phones and two from720px. No invented surcharge or promoted middle tier. |
| Editable duplicate package names could merge prices. | Stable duration_package_code drives selection/filter/key, like cashier; duplicate names get canonical package descriptors. Red/green browser regression. |
| Repeated uppercase labels and decorative location dot competed with content. | Duplicate eyebrows/dot removed; existing real logo/photo remain. Plain service copy explains calendar-hour estimates. |
| Small navigation/Maps/disclosure targets and faint control borders. |44px targets, measured borders/focus. Long labels and maximum tariffs wrap at200%. |

Public output is the orderable subset of the cashier source, additionally excluding package_available=false. Operational RPC/Auth are unchanged. Legacy rows without a POS package are excluded. Snapshot:31 published tariffs,14 Reguler/10 Ekspres/7 Kilat. These counts are verification evidence, not permanent business claims.

## Direction and verification

The five requested antislop skills apply during work. Design Read: public laundry homepage for local customers, existing purple identity and actual outlet photography, ENERGY2 / RHYTHM2 / MOTION1. Purple identifies actions/selection, neutral light surfaces support reading prices, and existing system typography avoids font downloads. Hero, catalogue, handover instructions, membership and location each answer a different customer decision. Existing three handover steps describe the actual process, without decorative round icons. No new asset, dependency or login route.

319 Node tests, build/TypeScript PASS. Browser evidence covers320/360/390/768/1024/1440, exact package prices/hours, keyboard selection, duplicate names,200% zoom,80/100-character labels and Rp1billion synthetic tariff. Public Production tariff snapshots render14/10/7 rows at390/1440 without overflow/page errors. These fields are public service data, not private customer data copied to QA. Final complete CI/deployment evidence is retained with release outputs.

Initial two Node regressions failed before implementation. QA caught reserved output name position, then a fixture conflicting with the existing grouped-service trigger; both corrected. Initial browser run reused a stale production server and failed three checks; the current build passed unchanged assertions. Review found duplicate package names; its new browser test failed before stable-code selection and passed afterward. Independent source recheck found no remaining actionable findings. Physical Android/TalkBack remains PHYSICAL_UAT_REQUIRED.

## Database, release and rollback

Migration `20261104160718_public_pos_service_catalog.sql` adds one STABLE read-only SECURITY DEFINER SQL function, empty search_path, qualified relations and fixed tariff output. No parameters, member/staff/session/finance/delivery/journal fields, backfill or table rewrite. Default PUBLIC execution revoked; anon/authenticated execution granted only on this function. Existing RLS/table grants and operational RPC authorization remain. Reference: [Supabase database functions](https://supabase.com/docs/guides/database/functions).

Project identities verified: QA cwxsbgfjynwxqalwonae, Production hncfyfvqtlnvqyfrydzb. QA rollback fixture verifies source prices/duration, anonymous projection, hidden/unavailable/inactive exclusions, edited duration and denied table/operational access. All synthetic mutations rolled back. QA signature refinement happened before release; migration metadata consolidated to one final canonical version. No customer/poin/financial mutations or operational flag changes.

Production receives only this verified new read function after exact-SHA CI; never run the synthetic fixture there. Rollback application to preceding verified deployment if needed; leaving the additive read function is compatible. Remove it only in a separate migration after every reader moves away. No data restore is necessary for this function-only change. Member tokens, real login and G8 requirements remain unchanged.

## Antislop delivery gate

PASS means changed homepage under automated/local review, not physical sign-off. Evidence: public-copy/route/refresh Node tests, service-catalog.ui, homepage-actions.ui, public.ui, public-member-entry.ui, membership-navigation.ui and public tariff screenshots. Contrast log: primary7.10, hover9.18, border5.07, body15.95, muted6.00, duration6.28, navigation8.85. Existing focus3.47 meets non-text3:1.

| Item | Status and evidence |
| --- | --- |
| R-02 | PASS: copy contracts; no new em dash or dramatic filler. |
| R-03 | PASS: six widths,200% reflow, long labels and maximum tariff. |
| R-17 | PASS: real scoped catalogue; unavailable backend shows no fallback numbers. |
| R-18 | PASS: no testimonials. |
| R-23 | PASS: existing logo/shop photo; no invented assets. |
| R-24 | PASS: header/footer/price/member/location destination checks. |
| R-25 | PASS: computed colour ratios above. |
| R-26 | PASS: package switching, disclosure and external action tests. |
| R-27 | PASS: initial loading, unavailable, empty and retained-price error states. Background refresh does not repeat loading announcements over existing prices. |
| R-28 | PASS: no generic FAQ. |
| R-32 | PASS: native controls, Enter selection, visible focus, menu Escape. |
| R-33 | PASS: source/CSS edited directly with apply_patch. |
| R-34 | PASS: existing light mode; no untested theme toggle. |
| R-35 | PASS: build/Chromium and action trace below. |
| R-36 | PASS: no fabricated security/performance/sign-off claims. |
| R-37 | PASS: established brand and declared direction/dials. |
| R-38 | PASS: actual public rates, explicitly synthetic test fixtures. |
| R-01 | PASS: purple action accent, no added gradients/glows. |
| R-04 | PASS: no generic icon library or emoji added. |
| R-06 | PASS: system type for phone readability; duplicate uppercase headings removed. |
| R-07 | PASS: no homepage background grid/pattern added. |
| R-08 | PASS: direct price CTA; external arrows indicate external destinations. |
| R-09 | PASS: no decorative headline badge; duration is factual metadata. |
| R-10 | PASS: no added glass. |
| R-12 | PASS: flat panels; menu shadow identifies an overlay. |
| R-13 | PASS: decorative location dot removed, no pulse/glow. |
| R-14 | PASS: variable-length tariff groups follow actual categories, not feature promotions. |
| R-19 | PASS: no new animation, reduced-motion regression. |
| R-22 | PASS: actual outlet photo, no generic illustration. |
| Liveliness dials | PASS: ENERGY2/RHYTHM2/MOTION1 declared and reflected by hierarchy/static content. |
| Liveliness focal point | PASS: hero price CTA, catalogue selector, member CTA. |
| Liveliness whitespace | PASS: distinct section density and phone scale. |
| Liveliness accent | PASS: purple action/selection accent. |
| Liveliness motif | PASS: actual laundry photo, service units, Rupiah prices. |
| Liveliness Design Read | PASS: declared before implementation. |
| C-1 | PASS: colour/type/layout/spacing purposes above. |
| C-2 | PASS: controls have verified behavior. |
| C-3 | PASS: no filler section; duplication removed. |
| C-4 | PASS: pending/empty/error/update/duplicate-name/long-label cases. |
| C-5 | PASS: synthetic automation distinct from physical acceptance. |
| R-05 | PASS: real package selector replaces repeated three-column pricing; genuine handover instructions remain. |
| R-11 | PASS: existing different radii for controls/panels/metadata, no pill-only design. |
| R-15 | PASS: specific price/WhatsApp/member/Maps CTAs. |
| R-16 | PASS: plain Indonesian service language. |
| R-20 | PASS: real local outlet, services and Owner-configured packages. |
| R-21 | PASS: established public light brand preserved. |
| R-29 | PASS: purple, ink and neutral surfaces. |
| R-30 | PASS: improves MasJawa composition, no external clone. |
| R-31 | PASS: major decisions have stated purposes above. |

UI supplement PASS: purposeful palette/accent, varied content, real tariffs/states, restrained motion and functional labels. Copy supplement PASS: source-backed facts, specific CTAs, no fabricated praise, quotes/caps/buzzwords or forced rhetorical trios; plain customer-service voice. Human supplement PASS for measured contrast,44px targets, focus/keyboard and emulated zoom; physical TalkBack pending. Layoutmobile supplement PASS for phone/tablet/desktop reflow, scale, wrapping, spacing, tap controls and labelled Menu; real Android remains required.

Action trace: header Layanan & Harga→#layanan, Cara Laundry→#keunggulan, Lokasi→#kontak; logo→homepage; hero price CTA→#layanan; Reguler/Ekspres/Kilat→own prices/hours with aria-pressed; duplicate-name selectors→distinct code tariffs; Informasi tarif dan estimasi→visible calendar-hour explanation; homepage/header/footer member links→/membership; Menu/Escape→destination/focus; footer Harga→#layanan; visible WhatsApp links→expected wa.me URL; Maps→expected Maps query. External destinations intercepted in browser tests; no WhatsApp message sent by the agent.
