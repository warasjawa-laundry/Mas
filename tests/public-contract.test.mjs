import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file) => readFileSync(join(process.cwd(), file), "utf8");
const page = read("app/page.tsx");
const member = read("app/membership/page.tsx");
const layout = read("app/layout.tsx");
const globals = read("app/globals.css");
const robots = read("app/robots.ts");
const sitemap = read("app/sitemap.ts");
const site = read("lib/site.ts");

test("homepage keeps legacy public anchors for old links", () => {
  for (const anchor of ["home","layanan","keunggulan","promo","testimoni","kontak"]) {
    assert.match(page, new RegExp('id="'+anchor+'"'));
  }
});

test("homepage does not inject a public owner dashboard or imaginary claims", () => {
  assert.doesNotMatch(page, /admin\/login|Beri Promo Otomatis|AI[- ]powered|Gratis untuk semua/i);
  assert.match(page, /memberProgramLaunched/);
  assert.match(page, /sedang menyiapkan kartu member/);
});

test("member program informational copy does not claim launched by default", () => {
  assert.match(site, /NEXT_PUBLIC_MEMBERSHIP_LAUNCHED === "true"/);
  assert.match(member, /Program sedang disiapkan/);
  assert.match(member, /Promo tidak diberikan otomatis/);
});

test("SEO and public routes have canonical, robots and sitemap", () => {
  assert.match(layout, /metadataBase/);
  assert.match(layout, /openGraph/);
  assert.match(member, /canonical: "\/membership"/);
  assert.match(robots, /"\/admin\/"/);
  assert.match(robots, /"\/k\/"/);
  assert.match(sitemap, /"\/membership"/);
});

test("accessible reduced-motion and mobile support included", () => {
  assert.match(globals, /prefers-reduced-motion: reduce/);
  assert.match(globals, /max-width: 480px/);
  assert.match(globals, /:focus-visible/);
  assert.match(page, /aria-labelledby/);
});

test("no secrets, fake customer reviews or unconfirmed automatic rewards in new homepage", () => {
  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE_KEY|api_key|password|Ibu Sari|Dimas Anggara|Mbak Rini/);
  assert.doesNotMatch(member, /promo otomatis|poin otomatis/i);
});

test("membership has a dedicated Open Graph and Twitter description", () => {
  assert.match(member, /openGraph:/);
  assert.match(member, /url: "\/membership"/);
  assert.match(member, /Kartu Member \\| Mas Jawa Laundry/);
  assert.match(member, /twitter:/);
  assert.match(member, /memberDescription/);
});
