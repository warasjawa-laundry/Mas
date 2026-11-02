import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(path,"utf8");
const list=read("app/admin/members/page.tsx")+read("components/admin/member-directory-list.tsx");
const detail=read("app/admin/members/[id]/page.tsx");
const promos=read("components/admin/member-promotions.tsx");
const whatsapp=read("components/admin/promo-whatsapp.tsx");
const css=read("app/admin/admin.css");
const publicCard=read("app/k/[token]/page.tsx");

test("customer list opens profiles and leaves protected promo implementation available but unlinked",()=>{
  assert.match(detail,/view===\"promo\"/);
  assert.match(list,/Lihat Profil/);
  assert.doesNotMatch(list,/view=promo|Kartu QR/);
  assert.doesNotMatch(list,/\.select\([^\n]*whatsapp_e164/);
  assert.match(promos,/id="promo-member"/);
});

test("WhatsApp contact and consent are read only after owner authentication",()=>{
  assert.match(detail,/requireOwner\(\)/);
  assert.match(detail,/whatsapp_e164,whatsapp_promo_consent/);
  assert.match(detail,/whatsappConsent=\{member\.whatsapp_promo_consent===true\}/);
  assert.match(whatsapp,/props\.memberActive && validPhone && props\.whatsappConsent/);
  assert.match(whatsapp,/const digits=allowed && validE164\(props\.whatsappPhone\) \?/);
  assert.doesNotMatch(publicCard,/whatsapp_e164|whatsapp_promo_consent|PromoWhatsapp/);
});

test("only available unexpired promos expose editable owner-initiated WhatsApp draft",()=>{
  assert.match(promos,/p\.status==="AVAILABLE" && !expired && memberActive/);
  assert.match(promos,/Siapkan pesan WhatsApp/);
  assert.match(whatsapp,/useState\(\(\)=>promoMessage\(props\)\)/);
  assert.match(whatsapp,/onChange=\{event=>\{setMessage/);
  assert.match(whatsapp,/Salin Pesan/);
  assert.match(whatsapp,/Buka WhatsApp/);
  assert.match(whatsapp,/https:\/\/wa\.me\//);
  assert.match(whatsapp,/encodeURIComponent\(message\.trim\(\)\)/);
  assert.match(whatsapp,/rel="noopener noreferrer"/);
  assert.doesNotMatch(whatsapp,/sendMessage\(|fetch\(|axios|supabase|\.insert\(|\.update\(/);
});

test("badges stay left of floating controls at narrow viewports",()=>{
  assert.match(promos,/owner-promo-status-row/);
  assert.match(css,/\.owner-promo-status-row\s*\{[^}]*display:\s*flex/);
  assert.match(css,/\.owner-promo-item\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/);
  assert.match(css,/\.owner-promo-actions[^{}]*\{[^}]*display:\s*flex/);
});

test("visits and manual promo lifecycle still independent of WhatsApp drafts",()=>{
  assert.doesNotMatch(whatsapp,/recordOwnerVisit|laundry_record_visit|grantManualPromo|finishManualPromo/);
  assert.match(promos,/action=\{grantManualPromo\}/);
  assert.match(promos,/action=\{finishManualPromo\}/);
  assert.match(detail,/<AmountVisitForm/);
  assert.match(read("components/admin/amount-visit-form.tsx"),/await recordAmountVisit\(formData\)/);
});
