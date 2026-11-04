import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as cashierPermissions from "../lib/pos/cashier-permissions.ts";

const memberId = "00000000-0000-4000-8000-000000000012";
const member = { id: memberId, display_name: "Synthetic customer fixture", member_number: 12, is_active: true, whatsapp_e164: "+6281234567890", address: "Synthetic address fixture", member_edit_revision: 7 };
const actions = Object.fromEntries(["loginOwner", "loginCashier", "changeOwnerPassword", "registerLaundryMember", "updateMemberContact", "saveCashier", "removeCashier", "revokeCashierDevices"].map(name => [name, () => {}]));
const calls = [];
let memberResult = member;
let memberError = null;
let issuanceReady = true;
const cashier = {staff_id:memberId, username:"MAS-0012", display_name:"Synthetic cashier fixture", active:true, permissions:{order_view:true, member_lookup:true}, active_devices:3};
const component = () => null;
const jsx = (type, props) => typeof type === "function" && type !== component ? type(props) : ({ type, ...props });
const query = table => {
  calls.push(table);
  const result = { data: table === "laundry_members" ? memberResult : [], error: table === "laundry_members" ? memberError : null, count: 0 };
  const q = { select(){return q}, eq(){return q}, order(){return q}, limit(){return q}, maybeSingle(){return q}, then(resolve,reject){return Promise.resolve(result).then(resolve,reject)} };
  return q;
};
function load(path) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const output = { exports: {} };
  const mocks = {
 "@/components/pos/context-notice":{readDisplayContext:v=>v?.pilot_test_only===false?v:null},
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": component,
    "node:crypto": { randomUUID: () => memberId }, "next/navigation": { notFound(){throw Error("NOT_FOUND")} },
    "@/lib/supabase/owner": { requireOwner: async () => ({ supabase: { from: query, rpc: async name => {calls.push(name);return {data:name==="laundry_pos_owner_list_cashiers"?[cashier]:[],error:null}} } }) },
    "@/lib/laundry/card": { memberNumber: () => "MJL-000012", cardIssuanceReady: () => issuanceReady },
    "@/app/admin/actions": actions, "@/app/kasir/actions": actions,
    "@/app/admin/members/actions": actions, "@/app/admin/members/contact/actions": actions,
    "@/app/admin/visits/actions": {correctOwnerVisit: component},
    "@/lib/admin/timing": {timeAdmin: (_name, callback) => callback()},
    "@/lib/laundry/member-history": {historyPageNumber: () => 1},
    "@/lib/pos/cashier-permissions": cashierPermissions,
    "@/lib/site": {site:{address:"Synthetic outlet address",shortAddress:"Synthetic outlet area"}},
    "./actions": actions,
    "./cashiers.module.css": {default:new Proxy({}, {get:(_target,key)=>String(key)})},
  };
  runInNewContext(code, { exports: output.exports, module: output, require(name){
    if (name.startsWith("@/components/admin/")) return component;
    assert.ok(name in mocks, name); return mocks[name];
  }, Intl, Date, Map, Set, Number, Promise });
  return output.exports.default;
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...[tree.children].flat(Infinity).flatMap(nodes)];
}
const render = async (path, searchParams = {}) => load(path)({ params: Promise.resolve({id:memberId}), searchParams: Promise.resolve(searchParams) });

test("default customer profile shows contact data without deferred panels or their reads", async () => {
  calls.length = 0;
  const tree = await render("app/admin/members/[id]/page.tsx");
  const text = JSON.stringify(tree);
  assert.match(text, /Synthetic customer fixture/);
  assert.match(text, /\+6281234567890/);
  assert.match(text, /Synthetic address fixture/);
  assert.doesNotMatch(text, /Catat transaksi|Kartu QR|\/admin\/scan|view=transaction/i);
  assert.deepEqual(calls, ["laundry_members"]);
  assert.ok(nodes(tree).some(node => node.href === `/admin/members/${memberId}/edit`));
});

test("directory exposes profile, edit and restored member card", () => {
  const tree = load("components/admin/member-directory-list.tsx")({members:[member]});
  const links = nodes(tree).map(node => node.href).filter(Boolean);
  assert.ok(links.includes(`/admin/members/${memberId}`));
  assert.ok(links.includes(`/admin/members/${memberId}/edit`));
  assert.ok(links.every(href => !/promo|scan|history/.test(href)));
  assert.ok(links.includes(`/admin/members/${memberId}/card`));
  assert.doesNotMatch(JSON.stringify(tree), /Catat|Promo/);
});

test("customer profile distinguishes unavailable data, missing customers, and empty contacts", async () => {
  try {
    memberError = {message:"Synthetic read failure"};
    const unavailable = await render("app/admin/members/[id]/page.tsx");
    assert.ok(nodes(unavailable).some(node => node.role === "alert"));
    assert.match(JSON.stringify(unavailable), /Muat ulang halaman/);
    assert.ok(!nodes(unavailable).some(node => node.href?.endsWith("/edit")));
    memberError = null;
    memberResult = null;
    await assert.rejects(render("app/admin/members/[id]/page.tsx"), /NOT_FOUND/);
    memberResult = {...member, whatsapp_e164:null, address:null, is_active:false};
    const inactive = JSON.stringify(await render("app/admin/members/[id]/page.tsx"));
    assert.match(inactive, /Nonaktif/);
    assert.equal((inactive.match(/Belum diisi/g)||[]).length, 2);
  } finally { memberResult = member; memberError = null; }
});

test("new customer form preserves registration action and request ID without asking promo consent", async () => {
  const tree = await render("app/admin/members/new/page.tsx");
  const all = nodes(tree);
  assert.ok(all.some(node => node.action === actions.registerLaundryMember));
  assert.ok(all.some(node => node.name === "requestId" && node.value === memberId));
  for (const field of ["name", "whatsapp"]) assert.ok(all.some(node => node.name === field));
  assert.ok(!all.some(node => node.name === "consent"));
  assert.doesNotMatch(JSON.stringify(tree), /Persetujuan promo|Scan|Memindai/);
});

test("contact edits preserve concurrency and consent semantics without promo controls", async () => {
  const all = nodes(await render("app/admin/members/[id]/edit/page.tsx"));
  assert.ok(all.some(node => node.action === actions.updateMemberContact));
  assert.ok(all.some(node => node.name === "expectedRevision" && node.value === 7));
  assert.ok(all.some(node => node.name === "consentAction" && node.type === "hidden" && node.value === "KEEP"));
  assert.ok(!all.some(node => node.name === "customerConfirmed"));
  assert.ok(!all.some(node => node.name === "consentAction" && node.type !== "hidden"));
});

test("registration retains card readiness lock and inline recovery instead of allowing an unavailable write", async () => {
  try {
    issuanceReady = false;
    const tree = await render("app/admin/members/new/page.tsx", {error:"save"});
    const all = nodes(tree);
    assert.ok(all.some(node => node.name === "name" && node.disabled));
    assert.ok(all.some(node => node.label === "Simpan Pelanggan" && node.disabled));
    assert.match(JSON.stringify(tree), /Kartu belum dapat diterbitkan/);
    assert.match(JSON.stringify(tree), /Pelanggan belum tersimpan/);
  } finally { issuanceReady = true; }
});

test("account keeps staff and password actions while service-price settings stay deferred", async () => {
  const tree = await render("app/admin/settings/page.tsx");
  assert.ok(nodes(tree).some(node => node.action === actions.changeOwnerPassword));
  assert.ok(nodes(tree).some(node => node.href === "/admin/pos/kasir"));
  assert.ok(nodes(tree).some(node=>node.href==="/admin/settings/services"));
 assert.match(JSON.stringify(tree),/Layanan & Harga/);
});

test("login uses Manajer and Kasir with existing ID payloads, actions, and errors", async () => {
  const owner = await render("app/admin/login/page.tsx", {error:"invalid"});
  const cashier = await render("app/admin/login/page.tsx", {role:"kasir"});
  assert.match(JSON.stringify(owner), /Manajer|MANAJER/);
  assert.match(JSON.stringify(cashier), /Kasir|KASIR/);
  assert.match(JSON.stringify(owner), /ID atau password tidak cocok/);
  assert.ok(nodes(owner).some(node => node.action === actions.loginOwner));
  assert.ok(nodes(owner).some(node => node.id === "owner-id" && node.name === "loginId"));
  assert.ok(nodes(cashier).some(node => node.action === actions.loginCashier));
  assert.ok(nodes(cashier).some(node => node.id === "login-cashier-id" && node.name === "username" && node.pattern === "MAS-[0-9]{4}"));
});

test("staff screen preserves every grant, action, staff payload and session count with customer-only lookup copy", async () => {
  const tree = await render("app/admin/pos/kasir/page.tsx");
  const all = nodes(tree);
  const permissionFields = all.filter(node => node.name?.startsWith("permit_"));
  assert.equal(permissionFields.length, cashierPermissions.CASHIER_PERMISSIONS.length * 2);
  for (const [key] of cashierPermissions.CASHIER_PERMISSIONS) {
    assert.equal(permissionFields.filter(node => node.name === `permit_${key}`).length, 2);
  }
  assert.ok(permissionFields.some(node => node.id === `${memberId}-member_lookup` && node.defaultChecked));
  assert.ok(permissionFields.some(node => node.id === `${memberId}-payment_collect` && !node.defaultChecked));
  for (const action of [actions.saveCashier,actions.removeCashier,actions.revokeCashierDevices]) assert.ok(all.some(node => node.action === action));
  assert.equal(all.filter(node => node.name === "staffId" && node.value === memberId).length, 3);
  assert.ok(all.some(node => node.name === "name" && node.value === cashier.display_name));
  const text = JSON.stringify(tree);
  assert.match(text, /Cari pelanggan/);
  assert.doesNotMatch(text, /Cari member dan scan QR|Owner saja yang login/);
  assert.match(text, /MAS-0012/);
  assert.match(text, /Sesi aktif/);
  assert.ok(all.some(node => node.children === 3));
});
