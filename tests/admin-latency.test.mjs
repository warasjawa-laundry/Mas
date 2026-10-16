import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("admin proxy refreshes claims while owner access still validates live user and role", () => {
  const proxy = source("proxy.ts");
  const owner = source("lib/supabase/owner.ts");
  assert.match(proxy, /await supabase\\.auth\\.getClaims\\(\\)/);
  assert.doesNotMatch(proxy, /await supabase\\.auth\\.getUser\\(\\)/);
  assert.match(owner, /supabase\\.auth\\.getUser\\(\\)/);
  assert.match(owner, /laundry_owner_accounts/);
  assert.match(owner, /owner\\?\\.is_active !== true/);
});

test("login relies on fresh Auth sign-in response and verifies active owner", () => {
  const actions = source("app/admin/actions.ts");
  const login = actions.split("export async function logoutOwner")[0];
  assert.match(login, /signInWithPassword/);
  assert.doesNotMatch(login, /auth\\.getUser\\(/);
  assert.match(login, /owner\\?\\.is_active !== true/);
});

test("admin loading states and pending buttons provide feedback", () => {
  assert.match(source("app/admin/loading.tsx"), /role="status"/);
  assert.match(source("app/admin/members/[id]/loading.tsx"), /role="status"/);
  assert.match(source("components/admin/owner-login-submit.tsx"), /useFormStatus/);
  assert.match(source("components/admin/amount-visit-form.tsx"), /useFormStatus/);
});

test("member list avoids hundreds of speculative authenticated prefetch requests", () => {
  const list = source("app/admin/members/page.tsx");
  assert.match(list, /prefetch=\\{false\\} href=\\{\\x60\\/admin\\/members\\/\\$\\{m\\.id\\}/);
  assert.match(source("app/admin/members/[id]/page.tsx"), /timeAdmin\\("member\\.detail\\.queries"/);
});
