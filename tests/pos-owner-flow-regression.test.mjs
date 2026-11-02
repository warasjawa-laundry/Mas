import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Owner never redirects to cashier login or borrows staff session",()=>{
 const board=read("components/pos/pos-board.tsx");
 assert.match(board,/owner \? "\/admin\/pesanan\/baru"/);
 assert.match(board,/owner \? "\/admin\/pesanan\/" : "\/kasir\/pesanan\//);
 assert.doesNotMatch(board,/owner \? "\/admin\/login\?role=kasir"/);
 const owner=read("app/admin/pesanan/baru/page.tsx");
 assert.match(owner,/requireOwner\(\)/);
 assert.match(owner,/OrderForm role="owner"/);
 assert.match(owner,/canWrite=\{false\}/);
 assert.doesNotMatch(owner,/cashierRpcAccess|getCashierSession/);
 for(const p of ["app/admin/pesanan/[id]/page.tsx","app/admin/kas/page.tsx","app/admin/laporan/page.tsx"]){
  assert.match(read(p),/requireOwner\(\)/);
  assert.doesNotMatch(read(p),/cashierRpcAccess|CASHIER_LOGIN_COOKIE/);
 }
});
test("Scanner actually rendered for member selection in shared order flow",()=>{
 const form=read("app/kasir/pesanan/baru/order-form.tsx");
 assert.match(form,/CashierQrScanner/);
 assert.match(form,/<CashierQrScanner role=\{role\}/);
 assert.match(form,/MemberNamePicker role=\{role\}/);
 const scanner=read("app/kasir/pesanan/baru/cashier-qr-scanner.tsx");
 assert.match(scanner,/role==="owner"\?resolveOwnerPosMemberCode:resolveCashierMemberCode/);
 assert.match(scanner,/decodeLaundryBarcodeImage/);
 assert.match(scanner,/BrowserMultiFormatReader/);
});
test("Owner barcode and name lookup use owner auth and read-only queries",()=>{
 const a=read("app/admin/pesanan/member-actions.ts");
 assert.match(a,/requireOwner\(\)/);
 assert.match(a,/resolveOwnerScannedCard/);
 assert.match(a,/resolveOwnerScannedBarcode/);
 assert.doesNotMatch(a,/recordOwnerVisit|createCashierOrder|laundry_record_visit/);
});
test("Owner read-only database APIs require owner in private security definer functions",()=>{
 const sql=read("supabase/migrations/20261102213000_pos_owner_read_only_routes.sql");
 assert.equal((sql.match(/v_owner:=laundry_private\.pos_owner_required\(\)/g)||[]).length,4);
 assert.match(sql,/public\.laundry_pos_owner_order_board\(\)/);
 assert.match(sql,/public\.laundry_pos_owner_order_detail\(p_order_id uuid\)/);
 assert.match(sql,/public\.laundry_pos_owner_cash_overview\(\)/);
 assert.match(sql,/public\.laundry_pos_owner_report_summary\(p_from date,p_until date\)/);
 assert.doesNotMatch(sql,/insert into|update public|delete from|grant execute .* to anon/i);
});
test("Owner menu and settings keep a single Binatu visual shell",()=>{
 const board=read("components/pos/pos-board.tsx");
 for(const href of ["/admin/scan","/admin/pos/import","/admin/kas","/admin/laporan","/admin/settings"])
  assert.ok(board.includes(href),href);
 const settings=read("app/admin/settings/page.tsx");
 assert.match(settings,/href="\/admin\/settings\/services"/);
 const importPage=read("app/admin/pos/import/page.tsx");
 assert.match(importPage,/binatu-page-cap binatu-pattern/);
 assert.match(read("app/admin/settings/services/page.tsx"),/binatu-outlet-head/);
});
test("Cashier sidebar hides links without grants and owner keeps own navigation",()=>{
 const nav=read("components/admin/admin-navigation.tsx");
 assert.match(nav,/cashierLinks\.filter/);
 assert.match(nav,/hasCashierGrant\(permissions,item.permission\)/);
 assert.match(nav,/CashierNavigation\(\{permissions\}/);
 assert.match(read("app/kasir/layout.tsx"),/permissions=\{session.permissions\}/);
});
