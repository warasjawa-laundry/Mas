import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(p,"utf8");
const header=read("components/site-header.tsx");
const home=read("app/page.tsx");
const membership=read("app/membership/page.tsx");
const scanner=read("components/customer-card-scanner.tsx");
const decoder=read("lib/laundry/qr-image.ts");
const parser=read("lib/laundry/scan.ts");
const progress=read("app/k/[token]/page.tsx");
const style=read("app/globals.css");

test("public header points to actual member page, not inactive homepage section",()=>{
 assert.match(header,/href: "\/membership", text: "Kartu Member"/);
 assert.doesNotMatch(header,/href: "\/#promo", text: "Kartu Member"/);
 assert.match(home,/siteHref\("\/membership"\)/);
 assert.match(membership,/<CustomerCardScanner \/>/);
 assert.match(membership,/siteHref\("\/admin\/login"\)/);
});

test("member holders can use camera or gallery locally, without login or searching names",()=>{
 assert.match(scanner,/decodeFromVideoDevice/);
 assert.match(decoder,/decodeFromCanvas\(canvas\)/);
 assert.match(decoder,/URL\.createObjectURL\(file\)/);
 assert.match(decoder,/URL\.revokeObjectURL\(url\)/);
 assert.match(scanner,/MAX_IMAGE_SIZE=12\*1024\*1024/);
 assert.match(scanner,/Pilih Foto QR/);
 assert.match(scanner,/Buka Kamera/);
 assert.match(scanner,/extractLaundryToken\(raw\)/);
 assert.match(scanner,/router\.push\("\/k\/"\+token\)/);
 assert.doesNotMatch(scanner,/getVerifiedOwner|requireOwner|resolveOwnerScannedCard|recordOwnerVisit|fetch\(|axios|FormData\(|supabase/);
 assert.doesNotMatch(scanner,/memberId|memberNumber|display_name|nama member|tempel link/i);
});

test("URL extraction rejects unknown host and never follows arbitrary QR destinations",()=>{
 assert.match(parser,/url\.protocol !== "https:"/);
 assert.match(parser,/url\.username \|\| url\.password \|\| url\.port \|\| url\.search \|\| url\.hash/);
 assert.match(parser,/OFFICIAL_CARD_ORIGIN/);
 assert.match(read("lib/laundry/card-origins.ts"),/masjawalaundry\.web\.id/);
 assert.match(parser,/const match = \/\^\\\/k\\\//);
 assert.doesNotMatch(scanner,/window\.location\.href|window\.open\(/);
 assert.match(progress,/laundry_public_card_progress/);
 assert.doesNotMatch(scanner,/laundry_record_visit/);
});

test("public scanner has mobile-friendly buttons and accessible error messaging",()=>{
 assert.match(style,/\.customer-card-scanner/);
 assert.match(style,/@media\(max-width:480px\)/);
 assert.match(style,/\.customer-scan-actions\{grid-template-columns:1fr\}/);
 assert.match(scanner,/role="alert"/);
 assert.match(scanner,/aria-label="Pratinjau kamera untuk memindai kartu member"/);
});
