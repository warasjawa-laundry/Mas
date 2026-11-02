
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeMemberBarcode} from "../lib/pos/member-code.ts";
const read=p=>readFileSync(p,"utf8");
test("barcode member accepts only printed MJL numbers, not arbitrary input",()=>{
 for(const [input,result] of [["MJL-001591","1591"],["1591","1591"],["0001591","1591"],[" mjl-0001591 ","1591"],["MJL-000000",null],["MAS-0001",null],["https://example.com/1591",null],["1234ABC",null],["000000",null],["1".repeat(25),null],["1\n2",null]])assert.equal(normalizeMemberBarcode(input),result);
});
test("cashier QR and barcode lookups are read-only and permission scoped",()=>{
 const action=read("app/kasir/pesanan/baru/qr-actions.ts");
 assert.match(action,/cashierRpcAccess\("member_lookup"\)/);
 assert.match(action,/laundry_pos_g4_member_number/);
 assert.match(action,/laundry_pos_g7_resolve_card/);
 assert.doesNotMatch(action,/recordOwnerVisit|laundry_record_visit|laundry_pos_g5_payment/);
 const scanner=read("app/kasir/pesanan/baru/cashier-qr-scanner.tsx");
 assert.match(scanner,/BrowserMultiFormatReader/);
 assert.match(scanner,/decodeLaundryBarcodeImage/);
 assert.match(scanner,/decodeLaundryQrImage/);
});
test("owner barcode uses owner authorization and active member lookup without posting",()=>{
 const source=read("app/admin/visits/actions.ts").split("export async function resolveOwnerScannedBarcode")[1];
 assert.match(source,/requireOwner\(\)/);
 assert.match(source,/\.eq\("is_active",true\)/);
 assert.doesNotMatch(source,/laundry_record_visit|laundry_pos_g5_payment/);
});
test("Argon POS role entry uses one board component and keeps both auth flows",()=>{
 const login=read("app/admin/login/page.tsx");
 assert.match(login,/loginOwner/);assert.match(login,/loginCashier/);
 assert.match(login,/role=kasir/);
 assert.match(read("app/kasir/page.tsx"),/PosBoard role="cashier"/);
 assert.match(read("app/admin/page.tsx"),/PosBoard role="owner"/);
 assert.match(read("components/pos/pos-board.tsx"),/Siap Ambil/);
});
