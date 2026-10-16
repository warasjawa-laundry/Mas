import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const login=read("app/admin/login/page.tsx");
const actions=read("app/admin/actions.ts");
const owner=read("lib/supabase/owner.ts");
const server=read("lib/supabase/server.ts");
const settings=read("app/admin/settings/page.tsx");
const scan=read("app/admin/scan/page.tsx");

test("ID and password login: no owner email input", () => {
  assert.match(login, /name="loginId"/);
  assert.match(login, /loginOwner/);
  assert.doesNotMatch(login, /type="email"|name="email"/);
  assert.match(actions, /OWNER_LOGIN_ID/);
  assert.match(actions, /signInWithPassword/);
});
test("owner access requires verified Supabase user AND active allowlist row", () => {
  assert.match(owner, /auth\.getUser\(\)/);
  assert.match(owner, /laundry_owner_accounts/);
  assert.match(owner, /owner\?\.is_active !== true/);
  assert.match(scan, /requireOwner\(\)/);
  assert.match(settings, /requireOwner\(\)/);
});
test("change password requires prior authentication and current password verification", () => {
  assert.match(actions, /getVerifiedOwner\(\)/);
  assert.match(actions, /password: current/);
  assert.match(actions, /updateUser\(\{ password: next \}\)/);
  assert.match(actions, /scope: "global"/);
  assert.match(settings, /currentPassword/);
  assert.match(settings, /newPassword/);
});
test("no hardcoded live dummy password or service role secret in client source", () => {
  for(const file of [login,actions,owner,server,settings,scan]){
    assert.doesNotMatch(file, /service_role|SUPABASE_SERVICE_ROLE_KEY|Demo@123|password123/);
  }
});
