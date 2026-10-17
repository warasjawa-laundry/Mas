import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const nav = read("lib/navigation.ts");
const header = read("components/site-header.tsx");
const footer = read("components/site-footer.tsx");
const home = read("app/page.tsx");
const member = read("app/membership/page.tsx");
const layout = read("app/layout.tsx");

test("all public first-party navigation uses one stable preview-aware helper", () => {
  assert.match(header, /siteHref\("\/"\)/);
  assert.match(header, /siteHref\(item\.href\)/g);
  assert.match(footer, /siteHref\("\/#layanan"\)/);
  assert.match(footer, /siteHref\("\/membership"\)/);
  assert.match(home, /siteHref\("\/#layanan"\)/);
  assert.match(home, /siteHref\("\/membership"\)/);
  assert.match(member, /siteHref\("\/"\)/);
  assert.match(member, /siteHref\("\/admin\/login"\)/);
});

test("preview links use a stable alias only with explicit Preview configuration", () => {
  assert.match(nav, /REVIEW_NAV_ORIGIN/);
  assert.match(nav, /VERCEL_ENV !== "preview"/);
  assert.match(nav, /VERCEL_GIT_COMMIT_REF !== "main"/);
  assert.match(nav, /url\.protocol !== "https:"/);
  assert.match(nav, /url\.hostname !== REVIEW_ALIAS_HOST/);
  assert.match(nav, /mas-git-main-m8traders-projects-081d9dc2\.vercel\.app/);
  assert.match(nav, /return path;/);
  assert.doesNotMatch(nav, /mas-ohmeuu3yy|mas-5v2dgookx/);
});

test("canonical SEO stays on the purchased domain, not a review hostname", () => {
  assert.match(layout, /site\.baseUrl/);
  assert.doesNotMatch(layout, /REVIEW_NAV_ORIGIN|REVIEW_ALIAS_HOST/);
  assert.doesNotMatch(member, /mas-git-main-m8traders/);
});
