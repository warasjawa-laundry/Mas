import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(path,"utf8");

test("all admin routes share mobile and desktop navigation with no extra auth calls", () => {
  const layout = source("app/admin/layout.tsx");
  const nav = source("components/admin/admin-navigation.tsx");
  assert.match(layout, /<AdminNavigation\s*\/>/);
  assert.match(nav, /admin-shell-sidebar/);
  assert.match(nav, /admin-shell-mobile/);
  for (const href of ["/admin", "/admin/scan", "/admin/members", "/admin/settings"]) {
    assert.ok(nav.includes(href), href);
  }
  assert.doesNotMatch(nav, /getUser\(|getClaims\(|requireOwner\(|\.from\(/);
});

test("dashboard only reads small counts with owner verification", () => {
  const page = source("app/admin/page.tsx");
  assert.match(page, /requireOwner\(\)/);
  assert.match(page, /count:"exact",head:true/);
  assert.match(page, /Promise\.all\(/);
  assert.doesNotMatch(page, /whatsapp_e164|token_ciphertext|laundry_member_promotions/);
});

test("login lands at the dashboard rather than the scanner", () => {
  assert.match(source("app/admin/actions.ts"), /redirect\("\/admin"\)/);
  assert.doesNotMatch(source("app/admin/login/page.tsx"), /redirect\("\/admin"\)/);
});

test("member search has stable bounded pagination and no implicit prefetch", () => {
  const page = source("app/admin/members/page.tsx");
  assert.match(page, /perPage = 25/);
  assert.match(page, /\.range\(offset,offset\+perPage-1\)/);
  assert.match(page, /\.order\("id",\{ascending:false\}\)/);
  assert.match(page, /prefetch=\{false\}/);
});

test("member detail prioritizes one explicit amount/points write over secondary tasks", () => {
  const page = source("app/admin/members/[id]/page.tsx");
  assert.ok(page.indexOf("<AmountVisitForm") > -1);
  assert.ok(page.indexOf("<AmountVisitForm") < page.indexOf('className="owner-detail-jump-links"'));
  assert.match(page, /<details className="owner-history-details" open>/);
  assert.match(page, /action=\{correctOwnerVisit\}/);
  assert.match(page, /<MemberPromotions/);
});
