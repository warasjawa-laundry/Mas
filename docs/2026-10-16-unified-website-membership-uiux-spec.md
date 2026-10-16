# Mas Jawa Laundry — UI/UX Design Specification v1.0

Date: 2026-10-16 (WIB)
Status: Proposed / design baseline; NOT implemented
Repository: warasjawa-laundry/Mas
Branch: plan/unified-laundry-membership-uiux
Production domain to preserve: https://masjawalaundry.web.id/
Companion: 2026-10-16-unified-website-membership-implementation-plan.md

## 1. Product decision and scope

Rebuild the public laundry website and add a standalone digital loyalty stamp-card experience in ONE repository, under ONE primary domain, with THREE deliberately different UX surfaces:
1. Public homepage: business credibility, actual services/pricing, contact and explanation of membership.
2. Owner/admin workspace: log in with owner credentials; add member; print card; scan physical QR with Android phone; confirm +1 visit; inspect history; create and grant a personalized promotion; generate text to copy/open in WhatsApp; mark promotion redeemed.
3. Member progress: no login, no OTP, no app install; scan physical card using the default phone camera to open a very limited read-only page.

Business constraints: NOT a POS, NOT laundry order/weight/status management, NOT payment processing, NOT a loyalty points engine. No automatic reward eligibility or promo assignment. Checklist/visit count is historical and cumulative; a promotion never resets or consumes visits. The owner alone decides promotions. A unique QR per active physical card is the member lookup key. Scanning alone NEVER adds a visit.

Keep the public site operating during development. No changes to main or production until a separate approved release. Deployment provider, DNS ownership, printer availability, final printed card stock, existing member import and promo policies require verification before implementation.

## 2. Evidence from current repository (code audit, not device/browser visual QA)

Files on main at the initial audit: index.html (~34 KB), script.js (~5.4 KB), style.css (~2.2 KB), _redirects, robots.txt, sitemap.xml, README.md, .nojekyll.
- Current static marketing homepage uses Tailwind via CDN, Outfit, purple #9333ea, blue #2563eb, orange #f97316, Lenis and GSAP/ScrollTrigger.
- Homepage has navigation anchors #home, #keunggulan, #promo, #testimoni, #layanan, #kontak and dedicated WhatsApp links.
- Existing #promo section advertises an exclusive member laundry bag, not digital checklist rewards. Do not silently replace, imply entitlement or promise this benefit without confirming with the business.
- Canonical and sitemap use masjawalaundry.web.id, and code embeds contact/address/service/pricing, Open Graph, and LaundryService structured data. Migrate verified factual content, not placeholder testimonials/prices.
- HTML references manifest.json, not found in current tracked root tree; body starts invisible and script.js removes invisibility only after JS initializes. Failure of an upstream script could render a blank screen.
- Page animation is dense; no reduced-motion branch apparent in inspected CSS/JS. Script also contains a mobile menu and scrolling sticky call-to-action. Instagram footer anchor is #; copyright is hardcoded 2024.
- _redirects contains a Netlify-domain -> custom-domain rule. New hosting must verify that actual platform can apply necessary redirects.
- Repo currently contains no dedicated membership pages/auth/database/QR scanner/PDF generator.

These are code findings; live rendering/accessibility metrics, search indexing, link reachability and business claim accuracy remain unverified until Stage 0 QA.

## 3. Users and principles

Owner persona: works alone or with occasional cashier support, Android phone is main scanner, may not be tech fluent, needs fast interaction while a customer waits.
Member persona: physical card user, may not install apps, create password or know how to navigate dashboards; sees only visit count and awarded promos.

Principles:
- One obvious primary action per screen. Indonesian plain language; never surface developer jargon.
- Critical controls at least 44 x 44 CSS px, readable text (body around 16 px), high contrast, visible focus state, simple labels, supportive errors.
- No checkout/POS fields in stamp flow. No automatic checkbox on camera success.
- Always show saving/success/failure clearly; do not celebrate a transaction until DB commit.
- Never trade privacy for convenience silently: public QR page is a bearer-link, not secure login.
- Default to lightweight pages; animation is optional decoration and respects prefers-reduced-motion.

## 4. Information architecture / routes

Public:
- / : main marketing page.
- /membership : simple "Cara Kerja Kartu Member" explainer, no user registration.
- Preserve or 301 redirect legacy anchor links when information moves (including #layanan, #promo).
Owner-only, server-protected:
- /admin/login : credentials, errors, forgot/reset path.
- /admin/scan : default landing after auth, camera scanner and manual search fallback.
- /admin/members : search/list/registration.
- /admin/members/[id] : details, history, print/reissue, manual promo.
- /admin/promos : owner-written promo history and status.
- /admin/settings : business identity, card printing preferences and owner account.
Member-only by unguessable link, read-only:
- /k/[token] : total valid visits, limited recent history, manual promo statuses.
- Invalid/revoked token: calm neutral error, no member information, "Hubungi Mas Jawa Laundry".

Owner and member share a DB but never share public editing APIs. Token in /k URL is NOT an admin authorization credential. No public member search or sequential member-ID lookup.

## 5. Public homepage redesign

Primary mobile nav: Beranda / Layanan & Harga / Kartu Member / Lokasi, plus clear WhatsApp action; avoid deep dropdowns. Desktop has a concise header; refrain from owner-admin controls in the main sales journey, but provide an unobtrusive /admin/login entry.

Recommended section flow:
1. Hero: real photo of the business (owner-approved), factual one-line value proposition, main action "Hubungi lewat WhatsApp", secondary "Lihat Harga". No hype/filler phrases. Avoid autoplay videos.
2. Layanan & Harga: scannable cards or tables, with units for per-kg/per-item and verified current price; mark exceptional services only if confirmed.
3. Kenapa Mas Jawa: 2–4 factual differentiators, no invented awards, certifications, testimonials or guarantees.
4. Kartu Member: simple three-step "Daftar di laundry → Bawa kartu saat transaksi → Scan QR untuk cek jumlah transaksi". Explain promos are assigned by owner, not automatic; link to /membership.
5. Galeri & Ulasan: actual approved photographs/real customer reviews or remove until verified.
6. Lokasi, jam dan kontak: actual address, simple map link/embed only if performant, WhatsApp.
7. Footer: current year generated; working social links only. Accurate owner-approved disclaimers.

Visual system: retain recognizable MJL logo and purple/blue accent with neutral white backgrounds; orange as sparing call-to-action/notice accent; no competing gradients on each card. Outfit may remain if rendered efficiently with fallback. Use consistent type scale, generous but not wasteful spacing, 8/12/16 px radius tiers, strong readable contrast. Responsive widths at 320/360/390/768/1024/1440 and zoom 200%.

Use subtle short transitions only where helpful; remove scroll blocking, parallax-first design and any blank-body dependency. Ensure meaningful content visible without JS and no layout shift from images.

SEO continuity: keep canonical production URL, preserve/redirect meaningful paths, metadata, contact numbers and structured data AFTER factual validation; sitemap for public URLs only; exclude /admin and /k; robot/noindex headers are not substitutes for authorization. Do not publish private token URLs to sitemap/analytics/referrer logs.

## 6. Owner UX — detailed flows

### 6.1 Login (only owner)
Simple title "Masuk Pemilik Laundry", identifier (username or email mapped securely) + password, show/hide password, login and safe error. Single-owner invitation/seed process; NO public admin signup. Persistent but revocable session; reauthentication for sensitive account/security changes. Never store plain password or implement auth solely in frontend.

### 6.2 Registration + print
From "Tambah Member": required Nama Pelanggan; optional Nomor WhatsApp (validate Indonesian normalized format, obtain contact consent); Save & Buat Kartu. Auto-generate permanent human-readable ID (e.g. MJL-000128) AND separate high-entropy bearer QR token. Success screen prioritizes:
- "Cetak Kartu" (default) -> print-ready PDF physical card.
- "Selesai / Cetak Nanti".
- Optional "Daftar Member Berikutnya".
No address, password, email or POS information required. Provide fuzzy duplicate warning for similar name/phone and owner resolution, but do not silently merge.
Print CR80 85.60 x 53.98 mm, QR high-contrast/adequate quiet zone, readable ID, logo, name optional, concise "Scan untuk cek transaksi" instruction. Printable A4 sheet batching as fallback. Browser printing without native printing integration; physical printer support must be validated. Reprint unchanged code for a normal reprint; lost/stolen: revoke old token, issue new, retain history.

### 6.3 Scan and add visit
Owner opens /admin/scan: camera permission prompt on intentional Start Scan, dominant viewfinder, torch toggle only if supported, switch camera when available, manual member lookup fallback. QR decode -> backend validates active card -> show compact identity preview and cumulative valid checklist count -> large button "Catat 1 Transaksi" -> server records append-only positive event with idempotency key -> success state "+1 transaksi berhasil dicatat" + updated total -> automatic return to scanner AFTER owner has seen confirmation. Never record on decode, nor from unauthenticated /k page.
Must tolerate QR repeated in same camera frame: pause scanning when member recognized; lock submit button while in flight; reopen scanner only after completion/cancel. Idempotency for network retry and double tap; deliberate multiple legitimate visits in one day must remain possible via new explicit confirmations. Optional same-day unusual-repeat warning, NEVER irrevocable silent rejection.
Failure states: camera denied, bad/expired/revoked token, card not found, offline, network timeout/unknown commit, duplicate retry, permission/access error. When result unknown, check server by request id rather than resubmit blindly. Do not show "+1" until committed.

### 6.4 Member list and history
Mobile search supports name, phone (owner only), or ID. Each row: member name, ID, current count, last activity. Detail: QR card status; exact transactions list with server timestamp in Asia/Jakarta; owner action to reverse an incorrect checklist by append-only reversal with required reason and admin actor; no hard deletion of history. Do not automatically reset count on promo award/redemption.

### 6.5 Owner-created promo and WhatsApp
Within member detail -> "Berikan Promo" -> free-text Nama Promo (required), Keterangan/Syarat (optional but recommended), optional expiry. Owner may give irrespective of visits. Preview summary -> "Simpan Promo" -> DB commit -> display saved promo -> "Salin Pesan" and if verified consented WhatsApp number "Buka WhatsApp".
Generate clear Indonesian template with business name, member greeting as appropriate, promo description, current visit count, optional expiry, instructions to present card; never promise membership threshold. WhatsApp deep link opens prepared message, not auto-sends. Status "belum dikirim / disalin / WhatsApp dibuka" is interaction telemetry ONLY, not proof delivered; owner may optionally mark "Sudah diberitahu" manually.
Owner can mark promo "Digunakan", "Dibatalkan", "Kedaluwarsa" as applicable, audit reason and timestamp; no member redemption action from public page, no decrement of checklist. For safety do not put QR token in WhatsApp message.

## 7. Member UX — one screen, zero login

Scan QR from ordinary camera -> https://masjawalaundry.web.id/k/[token]. Immediately show branded compact heading, member alias/first name or masked label, short ID, HUGE valid visit count with "kali laundry tercatat", last updated time, small chronological checklist entries, and only promos specifically awarded to this card's member with status ("Tersedia"/"Sudah digunakan"). No full phone number, address, staff names, notes, other member information, promotional rules suggesting automatic eligibility, or edit controls. Avoid displaying full legal name by default on the public QR view.
No separate app, OTP, password or account required. Support screen-reader labels, large font, fast load, no distractions. Plain message if not found: "Kartu tidak dapat dibuka. Minta bantuan petugas laundry."

Critical privacy trade-off: ANY holder/photo of QR can see limited progress. QR is a bearer link. Use cryptographically strong random token, token rotation upon lost card, revocation checks, minimal public projection, server-side access throttling, Cache-Control: no-store for personal data, noindex and restrictive Referrer-Policy, no leaking token in third-party analytics or image requests. If owner later requires identity-verified privacy, optional OTP can be added at cost of extra member friction. Explain this operationally to owner before launch.

## 8. Interface states, labels and design QA

Key labels: "Scan Kartu", "Tambah Member", "Cetak Kartu", "Catat 1 Transaksi", "Berikan Promo", "Salin Pesan", "Tandai Sudah Digunakan". Avoid "redeem", "eligible", "ledger", "reward tier". Confirmation is explicit and only for the consequential transaction/promo use, not for every navigation.

Success: check icon + clear count; warning: reason and fix; server error: retry with safe idempotency; no visits: "Belum ada transaksi yang dicatat"; promo empty: "Belum ada promo dari laundry". Loading: visible skeleton/spinner and disabled duplicate action; never blank page. Reachability: focus and accessible alert text for changes; no reliance on color alone.

Functional mobile acceptance target (testable, not existing metric): owner registration fields ≤2, initial scan-to-add journey one member preview + one commit tap, member public progress read without account, no horizontal overflow down to 320px, controls ≥44px, body text readable at 200% zoom; camera operates on real mid/low-end Android under HTTPS. Test weak 3G/poor lighting/low battery/camera denied and accessibility keyboard/screenreader/reduced-motion.

## 9. Page contracts and boundaries

Public page can only read sanitized member projection using active token; no enumerable member routes, no write endpoints. Owner role checked server-side for registration, token issue/revoke, checklists and promo mutations. Real-time only scoped to the currently authorized owner or exact public card projection; never broadcast private owner/member records to all connected clients. All meaningful mutations have actor, time, request id and immutable audit record.

Do NOT promise accurate live countdown/progress without network. Show last-updated and manual refresh on disconnected state. Telegram/WhatsApp Business API integration is excluded from MVP.

## 10. Content, assets and launch approvals

Prior to production: ask business owner to approve logo, service descriptions, actual prices, verified social handles/links, real photos/reviews, contact number and opening hours. Existing exclusive-bag program needs business confirmation and must not be silently conflated with digital member rewards.

Prototype approval screens: homepage desktop/mobile, owner login, member creation, print preview, scanner idle/recognized/success/error, member detail/history, manual promo editor + WA copy, public member count + promo and revoked-token error. Physical card readability and print fidelity must be tested before acceptance.

## 11. Decision log

LOCKED by user:
- One repo with homepage redesign and membership experience.
- Owner credentials only; member visits QR page without login.
- Mobile phone camera scan is MVP hardware.
- Member receives physical printable QR card.
- Checklist is historical transaction count; owner explicitly confirms each visit.
- All promos are manually chosen and written by owner; WhatsApp text copied or opened, not auto-sent.
- Member can view own limited progress and promo; owner can see all.
- No POS/operational laundry management.

TO VERIFY with business before acceptance, not reasons to stall planning:
- Owner-approved name/logo/assets/current service and pricing claims.
- Exact printing equipment and card material; paper/A4 fallback.
- Consent to store WhatsApp numbers and send promotional messages.
- Whether existing paper stamps/member IDs need opening balance migration, with manual audited adjustments only.
- Hosting/DNS/backup operator, support workflow for card loss and members with no smartphone.
