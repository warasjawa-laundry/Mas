# Stage 12 — Fresh Password Required on Every Admin Re-entry

**Date:** 2026-10-17 WIB  
**Scope:** PR #12, existing protected Mumbai QA Preview only. Production/main and customer Supabase remain unchanged.

## Problem verified in source
The previous admin login page redirected any existing Supabase owner session straight to the dashboard, and Supabase SSR persisted cookies over page refresh. This allowed walking away from the browser, then opening the homepage and returning to admin without typing the password. Hiding the login form alone cannot revoke authorization.

## Intended behavior
- Each full admin document entry, hard refresh, new visit from homepage, and restored browser-history page requires password again.
- Navigation between authenticated admin tabs/pages is uninterrupted.
- Login ID remains prefilled with `masjawalaundry`; password input starts empty and is not intentionally restored.
- A previously cached Supabase session alone must never be accepted by admin pages or server actions.
- Leaving admin for the public website signs out **this browser session** (not other devices). Password changes still sign out globally.
- Supabase credentials are never stored in the Git repository, browser UI, logs or documentation.

## Implementation checklist
- [x] Reworked `proxy.ts` to differentiate complete document GET requests and internal Next router requests, revoke the local Supabase session and redirect to login on hard refresh or re-entry.
- [x] Special one-use signed entry pass supports native form POST/redirect; consumed immediately. No repeat bypass on refresh.
- [x] Added separate HMAC-signed HttpOnly admin access grant bound to the verified Auth user's UUID; protected server routes require both a valid Supabase user and this grant.
- [x] Removed login-page auto-redirect when a Supabase cookie already exists.
- [x] Logout and password-change actions explicitly expire admin-scoped cookies using their correct `/admin` path.
- [x] Admin-to-public links use `/admin/leave`, where the proxy revokes local session and redirects home.
- [x] Added root-level Next client-router boundary for public → admin and admin → public soft navigations; browser history cache restore forces reauthentication.
- [x] Added admin `Cache-Control: private, no-store` response headers.
- [x] Kept login ID prefilled and blanked password on mount; no stored-password UI.
- [x] Added regression coverage for signed cookie grants, session reset paths, client-history boundary and login field defaults.
- [ ] Run all GitHub CI workflows to SUCCESS on a single SHA; historical stage9 UI test adjusted to expect reauthentication before denying old editor.
- [ ] Deploy passing SHA to the **existing QA Preview**, verify READY in Mumbai and QA branch alias, main alias unchanged.
- [ ] Manual authenticated Android QA: login → navigate admin tabs → refresh → login prompt with blank password; login → public homepage → return admin → login prompt; browser Back/Forward → no cached sensitive screen; invalid password rejected; successful login restores dashboard; logout and change-password effects.
- [ ] Production release and customer migration require independent approval.

## Security notes
- A **shared owner password remains a shared owner credential**; anyone who knows it can still authenticate. Separate restricted staff roles are the next step if needed.
- A page can never prevent browser-level password managers from offering stored credentials, but the application deliberately clears its own password input and does not reuse stored values.
- Because QA owner password was created privately in Supabase, authenticated browser end-to-end validation requires user-operated testing; unit/static and unauthenticated Playwright tests do not constitute proof of full post-login flow.
- Session re-entry behavior is deliberately stricter than the previous persistent login: a hard reload loses access until the password is entered again.

## Release boundary
No production SQL, production Auth or live domain change. Source stays on draft PR #12 pending QA review.
