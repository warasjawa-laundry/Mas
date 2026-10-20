# Netlify to Vercel preparation

Prepared 20 October 2026, Asia/Jakarta. Canonical URL remains https://masjawalaundry.web.id. This preparation does not merge main, publish a production deployment, change authoritative DNS or stop Netlify.

## Completed

- Vercel project `mas`, ID `prj_XaFKO8opffvnhL9c0oE3GrGPt3H2`, team `team_lAFGfoJ0FshlxvkpR2f2H5Hu`.
- Production targets added to the five existing operational environment entries: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OWNER_AUTH_EMAIL`, `OWNER_LOGIN_ID`, `LAUNDRY_CARD_ENCRYPTION_KEY`. Existing values and key material were preserved, not regenerated. The URL was checked against operational project `hncfyfvqtlnvqyfrydzb` and the API key verified as public. Branch-specific QA overrides remain separate.
- `masjawalaundry.web.id` assigned to this Vercel project. `www.masjawalaundry.web.id` assigned with a 308 redirect to the canonical apex. Domain ownership is verified; this does not mean DNS routing or HTTPS cutover is complete.
- Functions configured in repository for Mumbai (`bom1`), matching operational Supabase `ap-south-1`. Git auto deployment stays disabled; a merge does not publish by itself.
- Production database protection rejects a QA URL, missing public-key setting or inherited QA marker before database requests.
- Existing Google verification token read from the live Netlify page and preserved in Next.js metadata. Canonical remains unchanged. Preview metadata explicitly disables indexing. Admin/member token routes keep their private noindex headers.
- Operational database migrated with Stage 10, 16, 11, 17 and 18 definitions already tested in QA: card reissue infrastructure, scoped transaction history, database-only point rules, QR-scoped member name and editable service catalogue. Initial catalogue seeds the eight original rates; it does not copy unreviewed QA catalogue edits.
- Operational database still has 777 members. Existing card, checklist-event, transaction and promotion fingerprints, and 2026/2027 point rules, match the pre-preparation snapshot. Customer import provenance is retained. No card is reissued and no password is changed.
- Point-policy privileges and synthetic rollback suites for public history, catalogue and imported-member cards passed against the operational database. Security advisors show only previously documented items: direct card journals intentionally have no RLS policies/grants, and leaked-password protection remains paused.

Migration definitions match by name. The MCP applies migrations with deployment-time version numbers; older local SQL filenames therefore do not all match remote version numbers. Do not run a blind `supabase db push` as part of the hosting move. No migration runner is part of the application deployment. Reconcile migration history deliberately before adopting a CLI migration pipeline; do not reapply existing service/import table definitions.

## Exact remaining release steps

1. Approve and merge the tested PR #12 head into `main`. Record the resulting merge SHA. Keep Netlify publishing locked throughout.
2. Intentionally deploy that exact main SHA to Vercel **Production** using the configured project/team. Do not promote a QA preview as if it were the tested production build. Verify deployment environment and Mumbai function region. If staging without alias assignment is available, test that build first.
3. Check homepage, assets, prices, sitemap, robots, Google verification and login on the Vercel build. Authenticate using the existing operational owner identity. Read member details and history; use an explicitly approved test member for any new card or transaction write. Do not log or screenshot real QR tokens.
4. Change only web-routing DNS records at the authoritative provider, currently Netlify/NS1 (`dns1.p02.nsone.net` through `dns4.p02.nsone.net`). No connected Netlify DNS capability was available in this session. Export the DNS zone first and preserve unrelated TXT/MX/CNAME records. Current apex TXT/MX queries returned none; do not assume that child-name records also do not exist.
5. At cutover, re-fetch Vercel's domain configuration instead of assuming generic IP addresses. At preparation time the recommended rank-1 A set was `216.198.79.1` and `64.29.17.1`, and the recommended CNAME target was `95f01d8b55276096.vercel-dns-017.com.`. Use apex A records and `www` CNAME as instructed by the current Vercel domain check, replacing Netlify-managed web-routing records. Do not change nameservers merely to migrate hosting. Public resolver answers for Netlify's load-balanced apex can differ by region; save the authoritative record configuration, not a single resolved IP, for rollback.
6. Confirm domain DNS configuration and HTTPS are ready, apex serves the intended merge SHA, and `www` redirects while preserving the path. Recheck public pages for accidental `noindex`; keep `/admin`, `/k` and private APIs out of indexing. Issue customer cards from Production so QR URLs use the official origin. QA QR tokens remain tied to QA and are not migrated by DNS changes.
7. In existing Search Console, run live URL Inspection on the canonical homepage and check `/sitemap.xml`. Existing URL/property remains valid when verification is preserved; do not submit Change of Address for unchanged URLs. Account-level Search Console verification and submission have not been performed in this session.
8. Monitor errors and old/new hosting traffic. Keep Netlify and its current source available until traffic and Googlebot reach Vercel reliably.

## Rollback

Record the exact DNS zone configuration and the production deployment ID before cutover. If serving fails, restore the original Netlify web-routing records. Do not reverse additive database migrations or restore an old database snapshot over new member transactions. The original landing page can continue serving while the Vercel app is repaired. Once operating normally on Vercel, application rollback uses a known compatible production deployment and the same operational database and card key.

## References

- https://vercel.com/docs/domains/working-with-domains/add-a-domain
- https://vercel.com/docs/environment-variables
- https://vercel.com/docs/project-configuration/vercel-json
- https://developers.google.com/search/docs/crawling-indexing/site-move-no-url-changes
- https://support.google.com/webmasters/answer/9370220

No claim is made that Search Console account access, authenticated production browser tests, physical printer tests or the live DNS migration are complete.
