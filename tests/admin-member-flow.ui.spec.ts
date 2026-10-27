import {test,expect} from "@playwright/test";
import {readFileSync,mkdirSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import {createElement,type ReactNode} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";
const realRequire=createRequire(process.cwd()+"/package.json");
function component(path:string,extra:Record<string,unknown>={}){
 const source=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const output={exports:{} as {default:(p:Record<string,unknown>)=>ReactNode}};
 const mocks:Record<string,unknown>={"next/link":{default:({prefetch,...p}:Record<string,unknown>)=>createElement("a",p)},"@/lib/laundry/card":{memberNumber:(n:number)=>"MJL-"+String(n).padStart(6,"0")},...extra};
 runInNewContext(source,{require:(n:string)=>mocks[n]??realRequire(n),exports:output.exports,module:output,Intl,Date});return output.exports.default;
}
const Directory=component("components/admin/member-directory-list.tsx");
const Nav=component("components/admin/member-task-nav.tsx");
const RecoverableForm=component("components/admin/recoverable-form.tsx");
const Promos=component("components/admin/member-promotions.tsx",{
 "@/app/admin/promotions/actions":{grantManualPromo:()=>{},finishManualPromo:()=>{}},
 "@/components/admin/pending-submit":{default:({label,className="admin-primary"}:Record<string,string>)=>createElement("button",{className,type:"submit"},label)},
 "@/components/admin/promo-whatsapp":{default:()=>null},
 "@/components/admin/recoverable-form":{default:RecoverableForm},
});
const css=readFileSync("app/globals.css","utf8").replace(/^@import[^\n]*\n/,"")+"\n"+readFileSync("app/admin/admin.css","utf8");
const memberId="00000000-0000-4000-8000-000000000012";
const members=[{id:memberId,member_number:6,display_name:"Nama Contoh",is_active:true},{id:memberId+"x",member_number:5,display_name:"Member dengan nama sangat panjang untuk pengujian",is_active:false}];
for(const width of [320,390,1440])test(`compact member directory and explicit promo actions at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const shell=(content:string)=>`<style>body{margin:0}${css}</style><div class="admin-root"><main class="admin-workspace"><section class="admin-content owner-member-page">${content}</section></main></div>`;
 await page.setContent(shell(`<div class="member-directory-heading"><h1>Daftar Member</h1><a class="member-directory-add">+ Tambah</a></div><p class="admin-hint">Cari nama atau nomor member.</p>${renderToStaticMarkup(Directory({members}))}`));
 await expect(page.getByRole("link",{name:"Catat",exact:true})).toHaveCount(2);
 const row=page.locator(".member-directory-list>li").first();
 expect((await row.boundingBox())!.height).toBeLessThan(130);
 await row.locator("summary").click();
 await expect(row.getByRole("link",{name:"Promo",exact:true})).toHaveAttribute("href",/view=promo/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 mkdirSync("artifacts/screenshots",{recursive:true});await page.screenshot({path:`artifacts/screenshots/member-directory-${width}.png`,fullPage:true});
 await page.setContent(shell(`<h1>Nama Contoh</h1><p class="admin-hint">MJL-000006 · Member aktif</p>${renderToStaticMarkup(Nav({memberId,view:"promo"}))}${renderToStaticMarkup(Promos({memberId,memberName:"Nama Contoh",requestId:"synthetic",memberActive:true,whatsappPhone:null,whatsappConsent:false,loadFailed:false,promos:[{id:"synthetic-promo",title:"Diskon cuci 10%",terms:"Sekali untuk layanan reguler",status:"AVAILABLE",created_at:"2026-10-17T00:00:00Z",expires_at:null}]}))}`));
 await expect(page.getByRole("link",{name:"Promo",exact:true})).toHaveAttribute("aria-current","page");
 await expect(page.getByRole("button",{name:"Konfirmasi penggunaan"})).toBeHidden();
 if(width<=440){
  const useAction=await page.locator(".owner-promo-use>summary").boundingBox();
  const cancelAction=await page.locator(".owner-promo-cancel>summary").boundingBox();
  expect(cancelAction!.y-(useAction!.y+useAction!.height)).toBeLessThanOrEqual(20);
 }
 await page.getByText("Tandai Digunakan",{exact:true}).click();
 await expect(page.getByRole("button",{name:"Konfirmasi penggunaan"})).toBeVisible();
 await page.getByText("+ Berikan Promo",{exact:true}).click();
 await expect(page.getByLabel("Nama promo *")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:`artifacts/screenshots/member-promo-${width}.png`,fullPage:true});
});
for(const width of [320,390,1440])test(`transaction review makes recipient and amount explicit at ${width}px`,async({page})=>{
 let field=0;
 const Amount=component("components/admin/amount-visit-form.tsx",{
  react:{useState:(initial:unknown)=>[initial===false?true:++field===1?"75000":"Cuci setrika 15 kg",()=>{}]},
  "react-dom":{useFormStatus:()=>({pending:false})},
  "@/app/admin/points/actions":{recordAmountVisit:()=>{}},
 });
 await page.setViewportSize({width,height:900});
 const props={memberId,memberName:"Nama Contoh",requestId:"synthetic",memberActive:true,year:2026,tiers:[{minimum:0,points:0},{minimum:20000,points:1},{minimum:50000,points:3},{minimum:75000,points:5},{minimum:200000,points:20}]};
 await page.setContent(`<style>body{margin:0}${css}</style><div class="admin-root"><main class="admin-workspace"><section class="admin-content owner-member-page"><h1>Nama Contoh</h1><p class="admin-hint">MJL-000006 · Member aktif</p>${renderToStaticMarkup(Nav({memberId,view:"transaction"}))}${renderToStaticMarkup(createElement(Amount,props))}</section></main></div>`);
 await expect(page.getByRole("heading",{name:"Periksa transaksi"})).toBeVisible();
 await expect(page.locator(".transaction-review")).toContainText("Nama Contoh");
 await expect(page.locator(".transaction-review")).toContainText("Rp75.000");
 await expect(page.getByRole("button",{name:"Simpan transaksi",exact:true})).toBeEnabled();
 await expect(page.getByRole("button",{name:"Ubah isian"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 mkdirSync("artifacts/screenshots",{recursive:true});await page.screenshot({path:`artifacts/screenshots/member-transaction-review-${width}.png`,fullPage:true});
});
