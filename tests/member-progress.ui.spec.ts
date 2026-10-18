import {test,expect} from "@playwright/test";
import {readFileSync,mkdirSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import {createElement,type ReactNode} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";
const realRequire=createRequire(process.cwd()+"/package.json");
const compiled=ts.transpileModule(readFileSync("components/member-progress-view.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const out={exports:{} as {default:(props:Record<string,unknown>)=>ReactNode}};
const mocks:Record<string,unknown>={"next/link":{default:({prefetch,...props}:Record<string,unknown>)=>createElement("a",props)},"@/components/member-progress-refresh":{default:()=>createElement("button",{className:"member-refresh"},"Perbarui catatan")}};
runInNewContext(compiled,{require:(n:string)=>mocks[n]??realRequire(n),exports:out.exports,module:out,Intl,Date});
const css=readFileSync("app/k/[token]/progress.css","utf8");
const props={number:"MJL-000001",total:2,year:2026,points:5,balancesFailed:false,years:[{year:2026,href:"?year=2026"},{year:2027,href:"?year=2027"}],
 transactions:[{event_id:"a",occurred_at:"2026-10-17T05:00:00Z",amount_idr:75000,program_year:2026,awarded_points:5,cancelled:false},
 {event_id:"b",occurred_at:"2026-10-16T05:00:00Z",amount_idr:200000,program_year:2026,awarded_points:20,cancelled:true},
 {event_id:"c",occurred_at:"2026-10-15T05:00:00Z",amount_idr:null,program_year:null,awarded_points:0,cancelled:false}],historyFailed:false,page:1,nextHref:"?year=2026&page=2",promos:[]};
for(const width of [320,390,1440])test(`customer can trace points and cancelled transactions at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.setContent(`<style>body{margin:0}${css}</style>${renderToStaticMarkup(out.exports.default(props))}`);
 await expect(page.getByRole("heading",{name:"Poin dan transaksi"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Riwayat transaksi"})).toBeVisible();
 await expect(page.getByText("Rp75.000",{exact:true})).toBeVisible();await expect(page.getByText("+5 poin",{exact:true})).toBeVisible();
 await expect(page.getByText("20 poin dibatalkan",{exact:true})).toBeVisible();await expect(page.getByText("Tanpa nominal",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await expect(page.getByRole("link",{name:"Lebih lama →"})).toHaveAttribute("href",/year=2026&page=2/);
 mkdirSync("artifacts/screenshots",{recursive:true});await page.screenshot({path:`artifacts/screenshots/member-progress-final-${width}.png`,fullPage:true});
});
test("unavailable history is distinguished from a genuine empty year",async({page})=>{
 await page.setContent(`<style>${css}</style>${renderToStaticMarkup(out.exports.default({...props,historyFailed:true}))}`);
 await expect(page.getByRole("alert")).toContainText("Riwayat belum dapat dimuat");await expect(page.getByText("Belum ada transaksi pada tahun ini.")).toHaveCount(0);
 await page.setContent(`<style>${css}</style>${renderToStaticMarkup(out.exports.default({...props,transactions:[],points:0}))}`);
 await expect(page.getByText("Belum ada transaksi pada tahun ini.")).toBeVisible();await expect(page.getByRole("alert")).toHaveCount(0);
});
