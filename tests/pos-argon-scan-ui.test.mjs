import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(p,"utf8");
test("owner Argon POS exposes the existing secure scanner on sidebar and menu",()=>{
 assert.match(file("components/admin/admin-navigation.tsx"),/href: "\/admin\/scan"/);
 assert.match(file("components/pos/pos-board.tsx"),/href: "\/admin\/scan"/);
 const page=file("app/admin/scan/page.tsx");
 assert.match(page,/requireOwner\(\)/);
 assert.match(page,/<ScanCard\s*\/>/);
});
test("cashier wizard exposes a QR\/barcode reader only on authorized member section",()=>{
 const source=file("app/kasir/pesanan/baru/order-form.tsx");
 assert.match(source,/import \{CashierQrScanner\}/);
 assert.match(source,/canLookup&&<CashierQrScanner/);
 assert.match(source,/onMember=\{\(number,displayName\)=>\{setMember\(number\);setMemberName\(displayName\)\}\}/);
 const reader=file("app/kasir/pesanan/baru/cashier-qr-scanner.tsx");
 assert.match(reader,/resolveCashierMemberCode/);
 assert.match(reader,/BrowserMultiFormatReader/);
 assert.doesNotMatch(reader,/recordOwnerVisit|processOrderPayment/);
});
