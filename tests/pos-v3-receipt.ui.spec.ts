import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const req=createRequire(process.cwd()+'/package.json');
const webpack=req('next/dist/compiled/webpack/webpack-lib');
const fixtureDir=path.resolve('test-results/pos-v3-receipt-fixture'),bundle=path.join(fixtureDir,'bundle.js');
const css=readFileSync('components/pos/thermal-receipt.css','utf8');
const receipt={is_test_order:true,invoice:'MJL-V3-001',customer:'Penguji',actor:'Kasir Uji',created_at:'2026-11-01T12:09:00Z',due_at:'2026-11-04T12:09:00Z',ready_at:null,collected_at:null,work_status:'QUEUED',kind:'NEW',package:null,minutes:null,perfume:null,notes:null,total:'71300',paid:'10000',refunded:'0',remaining:'61300',status:'PARTIAL',contact:null,member:null,settings:{revision:1,config:{outlet_name:'MasJawa Laundry',address:'Alamat outlet terdaftar',contact:'Kontak outlet',new_title:'NOTA BARU',cs:'CS outlet'}},items:[{name:'Cuci Kering dengan nama layanan sangat panjang dan rincian tambahan agar turun baris',package:'Reguler',duration:'4320 menit',quantity_milli:1250,unit:'kg',price:'6000',subtotal:'7500'},{name:'Gorden',package:'Reguler',duration:'4320 menit',quantity_milli:2350,unit:'m',price:'8000',subtotal:'18800'},{name:'Bed Cover',package:'Reguler',duration:'4320 menit',quantity_milli:3000,unit:'pcs',price:'15000',subtotal:'45000'}]};
test.beforeAll(async()=>{
 mkdirSync(fixtureDir,{recursive:true});
 const files={'print-button':'app/kasir/pesanan/[id]/print-button.tsx','thermal-receipt':'components/pos/thermal-receipt.tsx',receipt:'lib/pos/receipt.ts','point-simulation':'lib/pos/point-simulation.ts'};
 for(const [name,file] of Object.entries(files))writeFileSync(path.join(fixtureDir,name+'.cjs'),ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 writeFileSync(path.join(fixtureDir,'empty.cjs'),'');
 writeFileSync(path.join(fixtureDir,'actions.cjs'),`exports.preparePrintReceipt=async(...args)=>{window.reads.push(args);if(window.failRead)return {error:'Koneksi terputus.'};return {error:'',data:window.receipt};};`);
 writeFileSync(path.join(fixtureDir,'entry.js'),`import React from 'react';import {createRoot} from 'react-dom/client';import {PrintButton} from './print-button.cjs';window.reads=[];window.printCalls=0;window.print=()=>window.printCalls++;createRoot(document.getElementById('root')).render(React.createElement(PrintButton,{orderId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'cashier',version:1,isTestOrder:true}));`);
 const aliases={'../receipt-actions':'actions.cjs','@/components/pos/thermal-receipt':'thermal-receipt.cjs','@/lib/pos/receipt':'receipt.cjs','./point-simulation.ts':'point-simulation.cjs','./thermal-receipt.css':'empty.cjs'};
 await new Promise<void>((resolve,reject)=>{const compiler=webpack({mode:'production',optimization:{minimize:false},entry:path.join(fixtureDir,'entry.js'),output:{path:fixtureDir,filename:'bundle.js'},resolve:{modules:[path.resolve('node_modules'),'node_modules'],alias:Object.fromEntries(Object.entries(aliases).map(([key,file])=>[key,path.join(fixtureDir,file)]))}});compiler.run((error:Error|null,stats:any)=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString())):resolve()));});
});
async function mount(page:Page,width=390){
 page.on('pageerror',error=>{throw error;});await page.setViewportSize({width,height:900});
 await page.setContent(`<style>body{margin:0;font-family:Arial}*{box-sizing:border-box}${css}</style><aside>Sidebar POS</aside><main><button>Pembayaran</button><div id="root"></div></main>`);
 await page.evaluate(data=>{(window as any).receipt=data;},receipt);await page.addScriptTag({path:bundle});
}
for(const roll of [58,80])test(`thermal ${roll} mm prints only backend receipt with wrapping, decimals and simulation warning`,async({page})=>{
 await mount(page,320);await page.getByLabel('Lebar kertas').selectOption(String(roll));
 await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await expect(page.getByRole('status')).toContainText('siap dicetak');
 expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);
 await page.getByRole('button',{name:`Cetak nota ${roll} mm`}).click();expect(await page.evaluate(()=>(window as any).printCalls)).toBe(1);
 await page.emulateMedia({media:'print'});
 await expect(page.locator('aside')).toBeHidden();await expect(page.getByRole('button',{name:'Pembayaran'})).toBeHidden();await expect(page.locator('.thermal-controls')).toBeHidden();
 const print=page.locator('body > .thermal-print-root');await expect(print).toBeVisible();
 for(const value of ['MasJawa Laundry','NOTA UJI - SIMULASI','BUKAN BUKTI PEMBAYARAN NYATA','TIDAK DIBUKUKAN','1,25 kg','2,35 m','3 pcs','Kasir : Kasir Uji','19:09 WIB','Sisa Tagihan :','Rp61.300'])await expect(print).toContainText(value);
 const size=await print.locator('.thermal-receipt').boundingBox();expect(size!.width).toBeCloseTo(roll*96/25.4,0);
 expect(await print.locator('.thermal-receipt').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 const amounts=await print.locator('.thermal-nominal').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().right));expect(Math.max(...amounts)-Math.min(...amounts)).toBeLessThan(1);
 mkdirSync('artifacts/screenshots',{recursive:true});await page.screenshot({path:`artifacts/screenshots/pos-v3-thermal-${roll}.png`,fullPage:true});
});
test('failed reads are recoverable and rereads fetch new payment state without creating transactions',async({page})=>{
 await mount(page);await page.evaluate(()=>{(window as any).failRead=true;});await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await expect(page.getByRole('alert')).toContainText('Koneksi terputus');await expect(page.getByRole('button',{name:'Cetak nota 58 mm',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{(window as any).failRead=false;});await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await expect(page.getByRole('status')).toContainText('siap dicetak');
 await page.evaluate(()=>{Object.assign((window as any).receipt,{status:'REFUNDED',paid:'71300',refunded:'71300',remaining:'71300'});});await page.getByRole('button',{name:'Baca ulang nota cetak'}).click();
 await page.emulateMedia({media:'print'});const print=page.locator('body > .thermal-print-root');await expect(print).toContainText('REFUND');await expect(print).toContainText('Sisa Tagihan : Rp0');await expect(print).toContainText('Tidak ada tagihan baru');
 expect(await page.evaluate(()=>(window as any).reads)).toEqual(Array.from({length:3},()=>['cashier','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']));expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);
});
