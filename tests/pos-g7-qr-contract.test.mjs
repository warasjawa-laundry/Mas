import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("cashier QR is permission-scoped and read only",()=>{
 const m=src("supabase/migrations/20261102063000_pos_g7_cashier_qr_lookup.sql");
 assert.match(m,/'member_lookup',false/);
 assert.match(m,/c.revoked_at is null and m.is_active/);
 assert.match(m,/token_digest=pg_catalog.decode/);
 assert.doesNotMatch(m,/insert into public.laundry_checklist_events|insert into public.laundry_pos_point_links/i);
});
test("server hashes validated QR and never posts transactions",()=>{
 const action=src("app/kasir/pesanan/baru/qr-actions.ts");
 assert.match(action,/extractLaundryToken\(raw\)/);
 assert.match(action,/cashierRpcAccess\("member_lookup"\)/);
 assert.match(action,/p_digest_hex:tokenDigest\(token\)/);
 assert.doesNotMatch(action,/laundry_record_visit|laundry_pos_g5_payment/);
});
test("scan camera and gallery stay read-only, local and bounded",()=>{
 const ui=src("app/kasir/pesanan/baru/cashier-qr-scanner.tsx");
 assert.match(ui,/decodeLaundryQrImage\(file\)/);
 assert.match(ui,/decodeFromVideoDevice/);
 assert.match(ui,/12\*1024\*1024/);
 assert.doesNotMatch(ui,/recordOwnerVisit|laundry_pos_g5_payment/);
 const order=src("app/kasir/pesanan/baru/order-form.tsx");
 assert.doesNotMatch(order,/import.*CashierQrScanner|<CashierQrScanner/);
});
