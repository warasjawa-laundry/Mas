# Stage 3 — Owner ID + Password contract

The owner explicitly chose **login ID `masjawalaundry`** and password, with **no email field** in the UI. Demo/temporary password requested, plus password-change functionality.

## Technical approach

Supabase Auth supports email/password or phone/password under the hood, not username/password natively. The browser sees ONLY ID and password. A private `OWNER_AUTH_EMAIL` maps the single fixed ID to a Supabase Auth identity server-side. The email is never submitted from a client form or rendered in the UI. The allowed login ID `masjawalaundry` is `OWNER_LOGIN_ID`.

After `signInWithPassword`, a Supabase Auth `getUser()` call AND row lookup `laundry_owner_accounts(auth_user_id, is_active=true)` must BOTH succeed. Login failure is generic, no user enumeration. All admin routes call `requireOwner()` and do not rely on a user-editable JWT metadata claim or a cookie alone. Browser endpoints cannot write tables directly. The RLS policies and grants from Stage 3 foundation remain unchanged.

UI screens: `/admin/login` (ID and password, show/hide toggle), `/admin/scan` (protected, explicitly not an active scanner), `/admin/settings` (old password + new password + repeat), logout. Password change confirms current password by fresh Supabase sign-in, requires >=12 chars upper/lower/number/symbol, calls `updateUser()` and global signout; new login required.

## Temporary password / owner onboarding

No usable dummy password is hardcoded or seeded into public GitHub, browser JS, example environment or SQL. It must be generated privately and set once via Supabase Auth admin **after** creating the chosen private Auth identity. Then a trusted admin explicitly inserts the Auth UUID into `laundry_owner_accounts`. SQL row count is 0 at this checkpoint, so login does not work yet and cannot accidentally grant anonymous access. Immediately replace temporary password via `/admin/settings`. Password reset without the current password must be an authenticated administrator process; synthetic internal addresses may not receive recovery mail. Don't promise a self-service password reset by email. For active security, prefer a real controlled recovery mailbox behind the scenes if available.

### Required runtime configuration
```
SUPABASE_URL=https://hncfyfvqtlnvqyfrydzb.supabase.co
SUPABASE_PUBLISHABLE_KEY=(current project's sb_publishable key)
OWNER_LOGIN_ID=masjawalaundry
OWNER_AUTH_EMAIL=(private Auth identity; not the UI login)
NEXT_PUBLIC_MEMBERSHIP_LAUNCHED=false
```

Store private environment variables in preview scope. Do not connect stage3 Auth UI to production until owner provisioning and security testing are complete.

## Safety checks before activation

- [ ] Confirm server-side internal Auth identity (may be a privately controlled email not shown to the owner).
- [ ] Provision exactly one confirmed Supabase Auth user via Admin user creation, with securely generated temporary password. Never allow self-signup in the app.
- [ ] Insert `auth.users.id` explicitly into `laundry_owner_accounts` after creation; verify actor RLS.
- [ ] Configure Vercel preview environment values and verify access restrictions.
- [ ] Confirm failed/malformed ID and rate-limited password attempts do not authenticate.
- [ ] Verify wrong Auth user cannot bypass allowlist.
- [ ] Verify changed password invalidates old password and signs out sessions.
- [ ] Automated tests + real Android UI signoff for keyboard, focus, password visibility, copy.
- [ ] Do NOT merge to `main` or production until checks above pass.

Status: Login/change-password CODE in progress; ACTUAL AUTH USER + TEMP PASSWORD not provisioned; not available to the business owner yet.
