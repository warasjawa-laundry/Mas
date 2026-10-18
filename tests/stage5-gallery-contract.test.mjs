import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const scan = readFileSync("components/admin/scan-card.tsx", "utf8");
const decoder=readFileSync("lib/laundry/qr-image.ts","utf8");
const css = readFileSync("app/admin/admin.css", "utf8");
const readAction = readFileSync("app/admin/visits/actions.ts", "utf8");

test("gallery picker is a user-initiated local image scan (never server-upload)", () => {
  assert.match(scan, /Pilih Foto QR/);
  assert.match(scan, /type="file"/);
  assert.match(scan, /accept="image\/png,image\/jpeg,image\/webp,image\/gif,image\/avif"/);
  assert.match(scan, /onChange=\{\(event\) => void scanScreenshot\(event\)\}/);
  assert.match(decoder, /URL\.createObjectURL\(file\)/);
  assert.match(decoder, /decodeFromCanvas\(canvas\)/);
  assert.match(decoder, /URL\.revokeObjectURL\(url\)/);
  assert.doesNotMatch(scan, /FormData\(|fetch\(|FileReader|multipart\/form-data|file\.arrayBuffer\(/);
});

test("invalid and oversized files are refused and the picker supports retry", () => {
  assert.match(scan, /MAX_GALLERY_BYTES = 12 \* 1024 \* 1024/);
  assert.match(scan, /SUPPORTED_IMAGE_TYPES/);
  assert.match(scan, /SUPPORTED_IMAGE_EXTENSIONS/);
  assert.match(scan, /file\.size === 0 \|\| file\.size > MAX_GALLERY_BYTES/);
  assert.match(scan, /event\.currentTarget\.value = ""/);
  assert.match(scan, /scanLock/);
  assert.match(scan, /workInProgress/);
});

test("camera and gallery share the same owner lookup, never write a visit", () => {
  assert.match(scan, /BrowserQRCodeReader/);
  assert.match(scan, /decodeFromVideoDevice/);
  assert.match(scan, /await onDecoded\(text\)/);
  assert.match(scan, /resolveOwnerScannedCard\(text\)/);
  assert.match(scan, /router\.push\("\/admin\/members\/" \+ member\.id\)/);
  assert.doesNotMatch(scan, /recordOwnerVisit|laundry_record_visit|\.insert\(/);
  assert.match(readAction, /requireOwner\(\)/);
});

test("phone UI has an accessible gallery action and no hidden image upload", () => {
  assert.match(scan, /aria-label="Pilih screenshot QR dari galeri"/);
  assert.match(scan, /type="button"[\s\S]*?Pilih Foto QR/);
  assert.match(css, /\.owner-gallery-button/);
  assert.match(css, /\.owner-gallery-hint/);
  assert.match(css, /@media\(max-width:440px\)/);
});
