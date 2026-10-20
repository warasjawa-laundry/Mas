import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 ADMIN_ACCESS_COOKIE, ADMIN_ENTRY_COOKIE, issueAdminAccess, validAdminAccess,
 issueAdminEntry, validAdminEntry
} from "../lib/admin/entry-pass.ts";
const read=p=>readFileSync(p,"utf8");
const guard=read("proxy.ts"),actions=read("app/admin/actions.ts"),owner=read("lib/supabase/owner.ts");
test("session grants are signed and bound to verified user",()=>{
 const old=process.env.LAUNDRY_CARD_ENCRYPTION_KEY;
 try{
  process.env.LAUNDRY_CARD_ENCRYPTION_KEY="test-only-key-with-over-32-characters-abcdef";
  const grant=issueAdminAccess("owner-1");
  assert.equal(validAdminAccess(grant,"owner-1"),true);
  assert.equal(validAdminAccess(grant,"owner-2"),false);
  assert.equal(validAdminAccess(grant+"tamper","owner-1"),false);
  assert.equal(validAdminAccess(undefined,"owner-1"),false);
  const one=issueAdminEntry("owner-1");
  assert.equal(validAdminEntry(one),true);
  assert.equal(validAdminEntry(one+"evil"),false);
 }finally{if(old===undefined)delete process.env.LAUNDRY_CARD_ENCRYPTION_KEY;else process.env.LAUNDRY_CARD_ENCRYPTION_KEY=old;}
});
test("full document entry, refresh, and leaving admin reset current local session",()=>{
 assert.match(guard,/isDocumentEntry\(request\)/);
 assert.match(guard,/sec-fetch-dest/);
 assert.match(guard,/isPublicToAdminRouterEntry/);
 assert.match(guard,/path==="\/admin\/leave"/);
 assert.match(guard,/clearAdminCookies\(request,response\)/);
 assert.match(guard,/auth\.signOut\(\{scope:"local"\}\)/);
 assert.match(guard,/clearSupabaseCookies\(request,response\)/);
 assert.match(guard,/NextResponse\.redirect\(new URL\("\/admin\/login\?notice=reauth"/);
 assert.match(guard,/validAdminEntry\(incomingEntry\)/);
 assert.match(guard,/request\.cookies\.delete\(ADMIN_ENTRY_COOKIE\)/);
});
test("valid owner token alone is insufficient without an admin session grant",()=>{
 assert.match(owner,/validAdminAccess\(/);
 assert.match(owner,/user\.id/);
 assert.match(actions,/jar\.set\(ADMIN_ACCESS_COOKIE,issueAdminAccess\(user\.id\)/);
 assert.match(actions,/h\.has\("next-action"\)/);
 assert.match(actions,/jar\.set\(ADMIN_ACCESS_COOKIE,"",\{\.\.\.adminSessionCookieOptions,maxAge:0\}\)/);
 assert.match(actions,/scope: "global"/);
});
test("login always prompts for password, keeps ID prefilled, and uses no cached password",()=>{
 const login=read("app/admin/login/page.tsx"),password=read("components/admin/owner-password.tsx");
 assert.doesNotMatch(login,/getVerifiedOwner\(\)|redirect\("\/admin"\)/);
 assert.match(login,/defaultValue="masjawalaundry"/);
 assert.match(password,/autoComplete="off"/);
 assert.match(password,/input\.current\.value=""/);
 assert.match(password,/name="password"/);
 assert.match(read("components/admin/admin-navigation.tsx"),/href="\/admin\/leave"/);
 assert.match(read("app/admin/scan/page.tsx"),/href="\/admin"/);
});

test("soft navigation crossing the homepage/admin boundary is not reusable authorization",()=>{
 const source=read("components/admin/site-admin-boundary.tsx");
 assert.match(read("app/layout.tsx"),/<SiteAdminBoundary \/>/);
 assert.match(source,/before\.startsWith\("\/admin"\)/);
 assert.match(source,/!path\.startsWith\("\/admin"\)/);
 assert.match(source,/window\.location\.replace\("\/admin\/leave"\)/);
 assert.match(source,/window\.location\.replace\("\/admin\/login"\)/);
 assert.match(read("components/admin/admin-history-guard.tsx"),/event\.persisted/);
 assert.match(read("next.config.ts"),/private, no-store, max-age=0/);
});
