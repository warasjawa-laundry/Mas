# Member Experience V2, 4 November 2026

Baseline `f293bda098e991c2584f5c3e395f5a522c03c901`. Scope: homepage member section, scanner, public card results, and public navigation. This implements the Owner's Member Experience V2 plan without changing authentication, issued numbers/tokens, database schema, customer records, points, catalogue or operational flags. PR #30 is excluded. G8 remains **NO_GO**.

## Design and implementation

Antislop core, UI, human, copywriting and layoutmobile apply during work, as requested. Design Read: preserve the existing public purple identity and light background; system typography remains readable on Android without font downloads. ENERGY 2 / RHYTHM 2 / MOTION 1. Purple marks the primary action, selected year and points; white space separates identity, balance, history and help. The result balance is larger than the all-time count. Mobile stacks these sections; desktop gives the balance twice the summary width. No new visual assets, dependencies, reward targets or promotional claims.

| Plan task | Implementation and evidence |
| --- | --- |
| 1 Homepage | Requested heading, description and Scan Kartu Member CTA link directly to `/membership`; no customer balance or internal login link. |
| 2 Scanner | Camera/gallery controls immediately follow the heading. Short positioning guidance, processing status, camera retry and gallery fallback. Existing local decoder, token validation and approved host rules remain. |
| 3 Results | Member number only, dominant selected-year balance, all-time count explicitly labelled, WIB history, original amounts, cancellation and pagination. Only API promos; genuine empty promo text. Help explains how to report discrepancies. |
| 4 2027 | 2027 is selectable without overriding the current WIB-year default. Missing balance is unavailable, not invented zero. A persistent Data Uji banner explains the portal is in testing and records are not payment proof. |
| 5 Access | Remove membership's internal login shortcut; homepage/header/footer already had none. Existing unified Owner/Kasir login, credentials, routes, sessions and grants remain unchanged. |
| 6 Privacy | Stop requesting full names. Anonymous route still hashes the token and calls three existing read-only RPCs. Revoked/inactive/unknown cards reject access. No contact/address/internal fields, client-supplied member ID, token display or third-party image on results. Existing noindex, no-referrer, private/no-store remain. |
| 7 Responsive | 320/360/390/768/desktop fixtures, stacked summaries, wrapping history, 44px controls and keyboard focus. Public footer/breadcrumb targets enlarged. CSS 200% reflow checked separately. |
| 8 Regression | Node route/refresh/security contracts; real Chromium public navigation, camera/video fixture, local QR photos, rejected QR, cancelled/legacy/history/error/promo states, login and POS regression. Synthetic data only. |
| 9 Release | One integration package on main; CI must pass for exact SHA before deploying existing Vercel mas project. Final SHA/run/deployment receipt is retained with release artifacts rather than guessing future CI outcomes here. |

Data Uji is a presentation warning for the prelaunch portal, not a rewrite of historical ledger classifications. It does not disappear on 1 January 2027. Removing it requires a separate approved cutover with opening balances, backup and operational evidence. This task neither resets points nor declares historical member events dummy.

## Verification and limitations

Local Node: 310 tests PASS. Next.js production build and TypeScript PASS. Initial red tests confirmed full-name fetching and the admin link before implementation. The first full browser run found two HTTP-status regressions caused by a new segment loading boundary streaming invalid-card responses as 200; that boundary was removed and the 404 assertions retained. The subsequent full run passed 118 tests; later keyboard-link and zoom checks extend this coverage. A camera-denial test initially selected Next's route-announcer along with the scanner alert; the locator now scopes to the scanner, with its assertion unchanged.

Do not add a loading boundary around token validation without preserving invalid-card HTTP status. Existing camera/gallery progress and refresh pending/disabled state provide loading feedback. Error recovery uses this installed Next.js version's `retry` callback; resetting only the boundary would not refresh server data.

Contrast checker evidence: purple/white 7.10:1, muted text/light panel 5.81:1, control border/white 5.07:1, purple text/light purple 8.73:1. Existing public focus/white is 3.47:1, satisfying the non-text focus threshold of 3:1; it is not used as normal body text. Result screenshots use synthetic members; never capture real bearer tokens or customer details.

Final focused checks passed 37 scenarios plus the separately rerun keyboard-navigation case. That case initially mixed a static fixture with an asynchronously hydrating Next page; each fixture now starts from a blank document before clicking its real destination. Assertions and real navigation remain. Two additional public 200% zoom tests pass. The complete CI suite now contains 121 browser tests; only CI evidence can establish its final result.

No database migration or SQL mutation belongs to this package. Existing SQL security/history tests continue in CI. Route mocks and browser fixtures prove code behavior, not human login or physical hardware acceptance. Physical Android camera/gallery, TalkBack, real Owner/Kasir login, issued-card scan and final content acceptance are **PHYSICAL_UAT_REQUIRED**. An authorized operator should perform them without sharing QR tokens/passwords in chat. Existing G8 restore, reconciliation and financial go-live blockers remain separate.

## Antislop delivery gate

PASS below means the changed member experience under automated/local review, not physical UAT or G8 acceptance. Evidence: source diff, `public-history`, `member-refresh`, `card-recovery`, `member-progress.ui`, `public-member-entry.ui`, `membership-navigation.ui`, `qr-gallery.ui`, `public.ui` tests and Chromium screenshots.

| Item | Result and evidence |
| --- | --- |
| R-02 punctuation | PASS: new public copy contains no em dash; copy contract tests retained. |
| R-03 reflow | PASS: phone/tablet/desktop and 200% fixture reflow; no horizontal overflow. |
| R-17 statistics | PASS: balance/count/amounts come from existing RPC props, not marketing statistics. |
| R-18 testimonials | PASS: none introduced. |
| R-23 assets | PASS: existing brand/text only; synthetic screenshots are test artifacts. |
| R-24 navigation | PASS: homepage/header/footer lead to scanner; result year/page links retain scope; recovery links lead to scanner. |
| R-25 contrast | PASS: measured pairs above; selected/control borders and focus use purple or tested border colour. |
| R-26 actions | PASS: camera, close camera, gallery, retry and refresh have handlers; link destinations covered by click/keyboard tests. |
| R-27 states | PASS: camera/gallery pending, refresh busy, unavailable balance/history, empty year/promo, rejected QR and recovery are explicit text. |
| R-28 FAQ | PASS: no generic FAQ added. |
| R-32 keyboard | PASS: year/page links work with Enter, focus visible, menu Escape retained; native buttons remain keyboard operable. |
| R-33 source editing | PASS: production source/CSS edited directly with apply_patch. |
| R-34 themes | PASS: established light theme, no theme toggle or alternate untested mode added. |
| R-35 execution | PASS: production build, Chromium runs and control checks; physical tests explicitly outstanding. |
| R-36 claims | PASS: no security/performance certification invented; Data Uji and test limitations visible/documented. |
| R-37 direction | PASS: declared direction/dials preserve existing public identity and Owner's supplied content. |
| R-01 gradients | PASS: no new gradient. |
| R-04 icons | PASS: no new icon library or generic icons. |
| R-06 typography | PASS: existing system typography for Android readability, no display monospace or decorative uppercase label. |
| R-07 patterns | PASS: no background grid/dot/blueprint. |
| R-08 arrows | PASS: new CTA and pagination use direct labels; existing external WhatsApp marker remains meaningful. |
| R-09 badges | PASS: Data Uji is an explanatory notice, not a decorative capsule. |
| R-10 glass | PASS: no glass added. |
| R-12 shadows | PASS: scanner remains flat; no elevation decoration added. |
| R-13 glow | PASS: no glow/status pulse. |
| R-14 hierarchy | PASS: balance dominates count; history and help use distinct structures. |
| R-19 motion | PASS: no new animation; reduced-motion regression retained. |
| R-22 illustration | PASS: no generic illustration added. |
| Liveliness dials | PASS: ENERGY2/RHYTHM2/MOTION1 declared and reflected in restrained accent, varied sections and static content. |
| Liveliness focal point | PASS: homepage CTA, scanner buttons and result balance each lead their screen. |
| Liveliness whitespace | PASS: explicit gaps between identity, period, balance, history and help. |
| Liveliness accent | PASS: existing purple is the single action accent. |
| Liveliness motif | PASS: purple member actions and tabular balance/amount typography repeat for this laundry card workflow. |
| Liveliness Design Read | PASS: direction recorded before visual implementation and repeated above. |
| C-1 intentionality | PASS: decisions serve scanning, reading points and reporting discrepancies. |
| C-2 completeness | PASS: controls have actual destinations/handlers; no dummy UI control introduced. |
| C-3 composition | PASS: removed redundant three-step cards; scanner precedes policy. |
| C-4 resilience | PASS: empty/error/long history/phone/zoom/keyboard fixtures; physical hardware remains required. |
| C-5 evidence | PASS: no fabricated business data/sign-off. |
| R-05 templates | PASS: content hierarchy follows the requested card journey, without a new hero/bento/stat chart template. |
| R-11 radius | PASS: notice, tabs, buttons and section containers have different purposes, no pill-only treatment. |
| R-15 CTAs | PASS: Scan Kartu Member, Buka Kamera, Pilih Foto QR, Perbarui catatan and Pindai kartu lain name actions. |
| R-16 language | PASS: concrete Indonesian laundry terms; no marketing superlatives/buzzwords. |
| R-20 identity | PASS: member number, annual points, WIB history and laundry assistance are domain-specific. |
| R-21 mode | PASS: existing public light identity preserved. |
| R-29 palette | PASS: purple, ink and neutral surfaces; existing green/red distinguish textual transaction states. |
| R-30 originality | PASS: existing MasJawa composition extended, no external product clone. |
| R-31 rationale | PASS: each major decision has a purpose in Design and implementation above. |

Copywriting checklist PASS: no fabricated names/data in product, no buzzwords or em dashes, no ornamental quotation/caps, direct actors/actions, specific CTAs and no forced three-step rhythm. Editorial review preserves a plain customer-service voice. Layoutmobile checklist PASS for automated widths, scale, grid collapse, overflow, touch targets, tap equivalents, mobile navigation and unobscured content; native keyboard/real-device zoom still require physical UAT. Human checklist PASS for tested colour pairs, focus, keyboard controls, textual states and emulated reflow; TalkBack/physical camera are not claimed passed.

Control trace: homepage CTA → scanner; header/footer member link → scanner; camera → synthetic video decode → token route; denied camera → retry → same useful error; gallery button → file chooser; valid PNG/JPEG/long screenshot → token route; invalid QR → error → valid retry; year 2026/2027 and older/newer → scoped URL by Enter; refresh handler → router.refresh with pending lock; brand → homepage; Pindai kartu lain → scanner; invalid-card recovery → scanner; mobile Menu → link and Escape restores focus. No WhatsApp message was sent by the agent.
