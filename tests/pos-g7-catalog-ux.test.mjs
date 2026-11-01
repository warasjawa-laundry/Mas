import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ALL_DURATIONS,durationOptions,servicesForDuration} from "../lib/pos/g7-catalog.ts";
import {calculateOrderTotals} from "../lib/pos/money.ts";
import {posUnitFromCatalog} from "../lib/pos/catalog-units.ts";
const source=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const catalog=[
 {id:"a",duration:"6 jam",unit:"kg",price_idr:12000},
 {id:"b",duration:"1–2 hari",unit:"kg",price_idr:8000},
 {id:"c",duration:"1–3 hari",unit:"kg",price_idr:6000},
 {id:"d",duration:"",unit:"meter",price_idr:3500},
];
test("duration choices are derived from real catalog, without invented express surcharge",()=>{
 const opts=durationOptions(catalog);
 assert.equal(opts[0].value,ALL_DURATIONS);
 assert.equal(opts[0].count,4);
 assert.equal(opts.length,5);
 assert.deepEqual(servicesForDuration(catalog,"6 jam").map(s=>s.id),["a"]);
 assert.deepEqual(servicesForDuration(catalog,"").map(s=>s.id),["d"]);
 assert.equal(servicesForDuration(catalog,"unknown").length,0);
 assert.equal(servicesForDuration(catalog,ALL_DURATIONS).length,4);
 assert.equal(opts.find(x=>x.value==="").label,"Durasi belum tercantum");
});
test("duration filter uses only each service's catalog price for precise total",()=>{
 const filtered=servicesForDuration(catalog,"1–2 hari");
 const q=calculateOrderTotals(filtered.map(s=>({priceIdr:String(s.price_idr),quantity:"1.255",unit:posUnitFromCatalog(s.unit)})));
 assert.equal(q.totalIdr,"10040");
 assert.equal(q.discountIdr,"0");
 assert.equal(q.feesIdr,"0");
});
test("G7 backend member prefix search is device-scoped and never exposes PII",()=>{
 const sql=source("supabase/migrations/20261102074500_pos_g7_member_name_search.sql");
 assert.match(sql,/pos_g4_cashier_authorize\([\s\S]*?'member_lookup',false\)/);
 assert.match(sql,/not between 3 and 60/);
 assert.match(sql,/limit 8/);
 assert.match(sql,/m\.is_active/);
 assert.match(sql,/starts_with/);
 assert.doesNotMatch(sql,/m\.address|m\.whatsapp_e164|m\.token_ciphertext|insert into public\.laundry_checklist_events/i);
 const action=source("app/kasir/pesanan/baru/member-search-actions.ts");
 assert.match(action,/cashierRpcAccess\("member_lookup"\)/);
 assert.match(action,/data\.slice\(0,8\)/);
 assert.doesNotMatch(action,/whatsapp|address|tokenDigest|recordOwnerVisit/);
});
test("G7 UI uses real duration step + named member disambiguation + honest tariff warning",()=>{
 const form=source("app/kasir/pesanan/baru/order-form.tsx");
 assert.match(form,/steps=\["Pelanggan","Durasi","Layanan","Konfirmasi"\]/);
 assert.match(form,/DurationSheet/);
 assert.match(form,/MemberNamePicker/);
 assert.match(form,/onSelect=\{value=>\{setDuration\(value\);setQuantities\(\{\}\)\}\}/);
 assert.match(form,/Total saat ini hanya harga layanan/);
 assert.match(form,/disabled=\{!canWrite\|\|!quote\|\|!customerValid\}/);
 const sheet=source("app/kasir/pesanan/baru/duration-sheet.tsx");
 assert.match(sheet,/aria-modal="true"/);
 assert.match(sheet,/e\.key==="Escape"/);
 assert.match(sheet,/e\.key!=="Tab"/);
 const picker=source("app/kasir/pesanan/baru/member-name-picker.tsx");
 assert.match(picker,/400\)/); // 400 ms debounce
 assert.match(picker,/onPick\(row\)/);
});
