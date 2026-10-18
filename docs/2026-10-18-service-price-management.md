# Owner-managed service catalogue

## User flow

Open Pengaturan → Kelola layanan dan harga. Add a service or expand an existing one. Set category, optional package, service name, integer Rupiah price, unit, optional turnaround, display order and homepage visibility. The same editor supports laundry, shoes, carpets and other categories; no fabricated shoe/carpet prices are seeded. Existing eight laundry/gorden prices are migrated unchanged.

Saving publishes the change. Hiding is reversible; there is no destructive delete in the UI. Errors remain inside the expanded form with inputs preserved. A version check prevents one browser from overwriting a newer edit. Pending saves disable the entire fieldset. A maximum of 200 services keeps the catalogue bounded. Price zero is explicitly allowed and shown as Rp0, never as an unspecified quote.

## Homepage updates

The server renders published services for SEO and first paint. Categories/packages are grouped automatically and arbitrary units such as kg, pasang, meter and m² are supported. The client lazily loads the pinned Realtime-only package and subscribes to a public version counter. Service rows and all member tables are excluded from this new publication change. Committed writes bump the counter, including hiding a row, so open visitors re-fetch the published catalogue without a page reload.

A no-store public endpoint exposes only published service fields. ETags avoid unchanged response bodies. A visible/online tab revalidates on focus, reconnect and at 30-second intervals as a fallback; failures show an explicit warning rather than silently advertising stale data as current. Realtime delivery depends on the network; there is no guarantee of zero latency. No images or Google Drive integration is part of this change.

## Access and data

Migration `20261018091320_stage18_service_catalog.sql` is installed only on isolated QA `tnadzytuamdxfypoeggy`. The service table uses RLS. Anonymous reads are column-limited and visibility-filtered; active owners can read the full editor projection. No web role receives direct table write permission. The public save wrapper is SECURITY INVOKER; the private writer explicitly verifies auth.uid against active owner accounts, validates every field, serializes the capacity check, checks the expected row revision and attributes the change to the actor. The shared counter contains no names, prices or private member details.

Only a publishable key or legacy anon-role key can be passed as public Realtime configuration; service-role/secret keys are rejected. Existing live Auth checks, password re-entry and membership/point rules remain unchanged. Catalogue prices do not rewrite historical transactions or change point thresholds. Staff sharing the owner's credentials have the same owner permission; a separate staff role is not introduced here.

Without backend configuration, the standalone build uses the existing price data. A configured backend error returns unavailable, never a silent static-price fallback. On release, apply the migration to the intended production database before deploying the application; no production database migration or main merge is performed here.

## Verification

Node tests cover field validation, category grouping/order, owner action access, versioned writes, cache invalidation, inline conflicts/errors and public-key filtering. The rollback-only SQL test runs on QA and PostgreSQL CI, covering owner/nonowner/inactive/anonymous access, hidden rows, actor-column privacy, immutable stale edits, invalid values, version bumps and the 200-row cap. Browser CI covers 320/390/1440 layouts, editable form controls, new categories/units, automatic refresh, visibility changes, failed updates, empty catalogues, ETag responses and sign-in protection. Real authenticated browser save is not claimed unless separately exercised.

Supabase advisors were reviewed after DDL. No new security finding was attributed to these tables/functions. The actor FK index may be reported unused before normal use; it is retained for FK maintenance. The previously paused leaked-password setting and closed card-table policies remain unchanged; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
