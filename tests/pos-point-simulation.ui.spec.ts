import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const req=createRequire(process.cwd()+'/package.json');
function component(file:string){
 const output={exports:{} as {default:(p:any)=>any}};
 const mocks:Record<string,unknown>={
  '@/lib/pos/g4-order':req('./lib/pos/g4-order.ts'),'@/lib/pos/point-simulation':req('./lib/pos/point-simulation.ts'),
  '@/app/kasir/pesanan/orders.module.css':{default:new Proxy({},{get:(_,key)=>key})},
 };
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{require:(n:string)=>mocks[n]??req(n),exports:output.exports,module:output});return output.exports.default;
}
const Card=component('components/pos/point-simulation.tsx'),Notice=component('components/pos/test-order-notice.tsx');
for(const width of [320,390,1440])test(`detail and print keep simulated points distinct at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const css=readFileSync('app/kasir/pesanan/orders.module.css','utf8');
 for(const state of ['UNPAID','PARTIAL','PAID','REFUNDED']){
  const data={booked:false,total_idr:'75000',paid_idr:state==='UNPAID'?'0':state==='PARTIAL'?'25000':'75000',refunded_idr:state==='REFUNDED'?'75000':'0',state,points:5,rule_available:true,program_year:2026,rule_revision:1,persisted_order:true};
  await page.setContent(`<style>body{margin:0;font-family:Arial}*{box-sizing:border-box}${css}</style><main class="shell">${renderToStaticMarkup(createElement(Notice,{isTestOrder:true}))}${renderToStaticMarkup(createElement(Card,{data}))}</main>`);
  const card=page.getByRole('region',{name:'Simulasi poin member'});
  await expect(card).toContainText('SIMULASI — TIDAK DIBUKUKAN');
  if(state==='REFUNDED'){await expect(card).toContainText('Simulasi poin dibatalkan');await expect(card).not.toContainText('+5 poin');}
  else{await expect(card).toContainText('+5 poin');await expect(card).toContainText(state==='PAID'?'Poin simulasi setelah pelunasan':state==='PARTIAL'?'menunggu pelunasan':'menunggu pembayaran');}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.emulateMedia({media:'print'});await expect(card).toBeVisible();await expect(page.getByRole('note',{name:'Nota uji'})).toBeVisible();await page.emulateMedia({media:'screen'});
 }
 mkdirSync('artifacts/screenshots',{recursive:true});await page.screenshot({path:`artifacts/screenshots/point-detail-refund-${width}.png`,fullPage:true});
});
