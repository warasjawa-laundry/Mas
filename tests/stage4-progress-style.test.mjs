import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route=readFileSync("app/k/[token]/page.tsx","utf8");
const css=readFileSync("app/k/[token]/progress.css","utf8");
const layout=readFileSync("app/layout.tsx","utf8");

test("customer QR route imports its own progress styles, outside admin layout",()=>{
 assert.match(route,/import "\.\/progress\.css"/);
 assert.doesNotMatch(layout,/admin\/admin\.css/);
 assert.match(css,/\.member-public-shell\s*\{/);
 assert.match(css,/\.member-count\s*\{/);
 assert.match(css,/\.member-count\s*>\s*strong\s*\{/);
 assert.match(css,/\.member-public-promos\s*\{/);
 assert.match(css,/\.member-public-foot\s*\{/);
});
test("member page remains read-only and does not disclose phone or private names",()=>{
 assert.match(route,/laundry_public_card_progress/);
 assert.doesNotMatch(route,/whatsapp_e164|display_name|token_ciphertext/);
 assert.doesNotMatch(route,/laundry_checklist_events|insert\(|update\(/);
});
