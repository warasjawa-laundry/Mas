## Stage 2 aktual — SEO, dependency, dan preview rendering (2026-10-16 WIB)

- Vercel preview build `f854907` merender `/` dan `/membership` dengan HTTP **200** melalui Vercel authenticated fetch; `robots.txt`, `sitemap.xml` dan URL optimasi hero image juga memberi HTTP **200**. Ini adalah request-level smoke, bukan sertifikasi visual.
- Metadata `/membership` kini memiliki Open Graph dan Twitter khusus; ada kontrak tes untuk menjaga perbedaan dari homepage.
- Lockfile `package-lock.json` dibuat GitHub Actions pada branch saja, versi dependency top-level ditetapkan tepat, dan `engines.node` menjadi `24.x`, sesuai versi proyek Vercel saat ini. CI Stage 2 menggunakan `npm ci`, bukan install bebas.
- Playwright Chromium menambah matriks layout 320/360/390/768/1024/1440px untuk `/` dan `/membership`, tanpa horizontal overflow, menu mobile, metadata, reduced motion. Bukti screenshot disimpan sebagai GitHub Actions artifact; hasil PASS/FAIL ditentukan dari CI terbaru (jangan menyimpulkan lulus sebelum menjalankan).
- Image artwork/harga berasal dari kode lama dan harus disetujui oleh owner. Konten membership tetap diberi label program sedang disiapkan. Tidak ada backend atau scanner pada Stage 2.
- Browser headless bukan perangkat Android fisik; aksesibilitas, keterbacaan, input sentuh, dan cropping foto tetap memerlukan owner UAT pada perangkat nyata.
- `main` dan domain produksi belum disentuh; jangan merge/deploy sebelum UAT dan konten faktual disetujui.

## Hasil verifikasi aktual Stage 2 — 16 Oktober 2026
- GitHub Actions `Stage 2 Public Site` untuk commit terbaru sebelumnya `0719dde20`: [run 38860506010](https://github.com/warasjawa-laundry/Mas/actions/runs/38860506010) **SUCCESS**: `npm install`, `npm run test`, `npm run typecheck`, `npm run build` lulus. Hasil ini membuktikan build kode, BUKAN audit tampilan Android atau produksi.
- UX refinement terakhir: panel lokasi memakai alamat terverifikasi dari konten kode lama dan tautan Google Maps; ilustrasi peta generik/fiktif dihilangkan agar tidak menyesatkan.
- Vercel mengirim check otomatis terhadap commit pada project `ombotak-property-s-projects/masjawalaundry`, tetapi akun Vercel yang saat ini terhubung ke assistant hanya memperlihatkan team `KingdomHub`. Karena itu log deployment preview tersebut belum dapat diaudit atau dipastikan READY. Jangan klaim preview tersedia.
- `main` masih tree SHA `46dcafb5f9a2f2c69b591e5e7c4a6c6e848ba1ef` pada pemeriksaan terakhir. Tidak ada merge atau promosi produksi.
- Persetujuan foto/tarif, render UI langsung di browser, tes telepon Android, `package-lock.json`, dan pemeriksaan deployment Vercel tetap gate terbuka.

# Stage 2 — Public Homepage Implementation Checkpoint
Tanggal: 2026-10-16 WIB
Branch: `feature/stage2-homepage-redesign` (stacked on `plan/unified-laundry-membership-uiux`)
Status: CODE WRITTEN, BUILD/DEVICE/OWNER APPROVAL PENDING — NOT PRODUCTION CERTIFIED.

## Isi implementasi
- Next.js App Router, TypeScript, CSS sendiri (tidak mengandalkan Tailwind CDN), server-rendered public route `/` dan `/membership`.
- Site header desktop/mobile dengan tautan layanan-harga, tentang usaha, kartu member, lokasi, WhatsApp. Mobile memakai native `details` sehingga tetap bisa navigasi tanpa JS.
- Hero berisi uraian layanan nyata, CTA WA dan harga. Harga kiloan (Reguler/Express/Kilat) dan gorden disalin dari kode lama, TIDAK diverifikasi aktual.
- Foto dan logo via repositori `warasjawa-laundry/Web-asset` dengan commit sha `f259a9e`, sementara. Belum disetujui oleh owner, perlu pindahkan aset approved menjadi lokal agar tidak tergantung GitHub.
- Konten tentang usaha tanpa klaim tak terbukti (garansi, satu-mesin, parfum, air filter). Testimonial lama tidak ditampilkan sampai sumber/izin diverifikasi.
- Membership informational page; fitur digital member **tidak aktif**: flag `NEXT_PUBLIC_MEMBERSHIP_LAUNCHED=false` secara default. Jangan nyalakan sebelum Stage 3–7 tersedia dan lulus QA.
- SEO: metadata, canonical, OG, JSON-LD minimal, sitemap/robots membatasi admin/member dari discovery. Keamanan admin/member nanti wajib authentication dan server-side DB row policy, robots bukan keamanan.
- Preserve legacy anchors `#home`, `#layanan`, `#keunggulan`, `#promo`, `#testimoni`, `#kontak`; review semantic naming `#testimoni` saat owner menyetujui ulasan/galeri.
- Reduced motion, mobile responsive, button target >=44px, visible focus, safe fallbacks.
- Draft CI workflow: npm install, node tests, typecheck and Next build. `package-lock.json` not generated (tool environment is offline); must be generated and pinned before release.
- Old `index.html`, `style.css`, `script.js` retained in GitHub to protect legacy/rollback but they are NOT used by Next routes. Do not delete until hosting migration is approved.

## Known blockers and acceptance gates
- [ ] Check exact Next/React patched release + lockfile; CI TypeScript/build must be GREEN (do not claim success until observed).
- [ ] Visual and responsive browser QA on Android/desktop at 320/360/390/768/1024/1440; inspect image cropping, modal/menu accessibility, 200% zoom, no horizontal overflow.
- [ ] Business owner approves prices/durations, documented photos, service descriptions, current business contact details and business hours. Remove "harga lama" explanatory disclaimer only after owner approval.
- [ ] Test actual availability of pinned source image URLs. Move approved images into `public/assets`.
- [ ] Confirm real hosting/DNS, production rollback and HTTPS, preserve SEO and any Netlify redirects.
- [ ] Stage 3–7 needed before enabling member public read or QR staff functions.
- [ ] No deploy, no merge until owner/technical review. Maintain legacy site as production.
- [ ] Physical print and scanner workflows are NOT included in Stage 2.

## Test cases in code
`node --test tests/public-contract.test.mjs` ensures public nav anchors, off-by-default membership wording, no invented review claims, SEO route declarations, reduced motion declarations.

## Manual review paths
`/` (public homepage)
`/membership` (informational)
`/#layanan`, `/#keunggulan`, `/#promo`, `/#testimoni`, `/#kontak`.
No `/admin` or `/k/[token]` yet.

## Migration risk
This refactor changes the build/runtime from static HTML to Next.js. Do NOT point existing production hosting at this branch before confirming a Next-compatible deployment target and a reversible migration.
