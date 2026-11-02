import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Owner POS routes use owner session without cashier login or synthetic staff",()=>{
 const board=read("components/pos/pos-board.tsx");
 const owner=read("app/admin/pesanan/baru/page.tsx");
 assert.match(board,/addHref = owner \? "\/admin\/pesanan\/baru"/);
 assert.match(board,/detailBase = owner \? "\/admin\/pesanan\/"/);
 assert.doesNotMatch(board,/owner \? "\/admin\/login\?role=kasir"/);
 assert.match(owner,/role="owner"/);
 assert.match(owner,/createAction=\{ownerPosWriteLocked\}/);
 assert.doesNotMatch(owner,/cashierRpcAccess|loginCashier/);
});
test("Barcode and QR are in the customer step, owner lookup is authenticated and read only",()=>{
 const form=read("app/kasir/pesanan/baru/order-form.tsx");
 const action=read("app/admin/pesanan/member-actions.ts");
 assert.match(form,/<CashierQrScanner role=\{role\}/);
 assert.match(form,/<MemberNamePicker role=\{role\}/);
 assert.match(action,/requireOwner\(\)/);
 assert.match(action,/resolveOwnerScannedCard/);
 assert.match(action,/\.eq\("is_active",true\)/);
 assert.doesNotMatch(action,/recordOwnerVisit\(|laundry_record_visit|\.insert\(/);
});
test("Owner menu placement follows POS architecture and staff menu respects grants",()=>{
 const board=read("components/pos/pos-board.tsx");
 for(const x of ["Operasional","Data & pelanggan","Pengaturan","/admin/scan","/admin/pos/import","/admin/settings/services"])assert.ok(board.includes(x),x);
 assert.match(board,/permissions\?\.\[link.permission\]===true/);
 assert.match(read("components/admin/admin-navigation.tsx"),/hasCashierGrant\(permissions,item.permission\)/);
 assert.match(read("app/kasir/page.tsx"),/params.view!=="menu"/);
});
test("Restore scanner, Binatu import, catalog within same MasJawa POS visual shell",()=>{
 const shell=read("components/pos/pos-workspace.tsx");
 assert.match(shell,/binatu-board binatu-workspace/);
 assert.match(shell,/binatu-outlet-head/);
 for(const path of ["app/admin/scan/page.tsx","app/admin/pos/import/page.tsx","app/admin/settings/services/page.tsx"]){
  assert.match(read(path),/PosWorkspace/);
 }
});
test("Owner POS writes remain disabled with read-only SQL actor authorization",()=>{
 const sql=read("supabase/migrations/20261102184000_pos_owner_readonly_ui.sql");
 assert.match(sql,/pos_owner_required\(\)/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/revoke all on function public.laundry_pos_owner_order_board/);
 assert.match(sql,/grant execute on function public.laundry_pos_owner_order_board\(\) to authenticated/);
 assert.doesNotMatch(sql,/insert into|update public|delete from/i);
 const action=read("app/admin/pesanan/actions.ts");
 assert.match(action,/redirect\("\/admin\/pesanan\/baru\?error=disabled"\)/);
 assert.doesNotMatch(action,/cashierRpcAccess|createCashierOrder/);
});
