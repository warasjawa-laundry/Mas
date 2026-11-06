import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const req=createRequire(process.cwd()+'/package.json');
const webpack=req('next/dist/compiled/webpack/webpack-lib');
const fixtureDir=path.resolve('artifacts/fixtures/pos-v31-thermal'),bundle=path.join(fixtureDir,'bundle.js');
const css=readFileSync('components/pos/thermal-receipt.css','utf8');
const payment={amount_idr:'10000',received_at:'2026-11-06T00:00:00Z',receiver:'Kasir Kedua',method:'CASH'};
const receipt={service_subtotal:'71300',fees_idr:'0',discount_idr:'0',payments:[payment],refunds:[],order_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',order_version:'1',payment_version:'1',snapshot_at:'2026-11-06T00:00:00Z',is_test_order:true,invoice:'MJL-V3-001',customer:'Penguji',actor:'Kasir Uji',created_at:'2026-11-01T12:09:00Z',due_at:'2026-11-04T12:09:00Z',ready_at:null,collected_at:null,work_status:'QUEUED',kind:'NEW',package:null,minutes:null,perfume:null,notes:null,total:'71300',paid:'10000',refunded:'0',remaining:'61300',status:'PARTIAL',contact:null,member:null,settings:{revision:1,config:{outlet_name:'MasJawa Laundry',address:'Alamat outlet terdaftar',contact:'Kontak outlet',new_title:'NOTA BARU',terms:'1. Pengaduan Komplain max 1x24 jam.\n2. Ketentuan panjang tidak dicetak.',bank:'Bank rahasia',cs:'CS outlet'}},items:[{name:'Cuci Kering dengan nama layanan sangat panjang dan rincian tambahan agar turun baris',package:'Reguler',duration:'4320 menit',quantity_milli:1250,unit:'kg',price:'6000',subtotal:'7500'},{name:'Gorden',package:'Reguler',duration:'4320 menit',quantity_milli:2350,unit:'m',price:'8000',subtotal:'18800'},{name:'Bed Cover',package:'Reguler',duration:'4320 menit',quantity_milli:3000,unit:'pcs',price:'15000',subtotal:'45000'}]};
test.beforeAll(async()=>{
 mkdirSync(fixtureDir,{recursive:true});
 const files={'print-button':'app/kasir/pesanan/[id]/print-button.tsx','thermal-receipt':'components/pos/thermal-receipt.tsx',receipt:'lib/pos/receipt.ts','point-simulation':'lib/pos/point-simulation.ts'};
 for(const [name,file] of Object.entries(files))writeFileSync(path.join(fixtureDir,name+'.cjs'),ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 writeFileSync(path.join(fixtureDir,'empty.cjs'),'');
 writeFileSync(path.join(fixtureDir,'actions.cjs'),`exports.preparePrintReceipt=async(...args)=>{window.reads.push(args);if(window.holdRead)await new Promise(resolve=>window.releaseRead=resolve);if(window.failRead)return {error:'Koneksi terputus.'};return {error:'',data:structuredClone(window.receipt)};};`);
 writeFileSync(path.join(fixtureDir,'entry.js'),`import React from 'react';import {createRoot} from 'react-dom/client';import {PrintButton} from './print-button.cjs';window.reads=[];window.printCalls=0;window.print=()=>{window.printCalls++;window.printed=document.querySelector('.thermal-print-root').textContent;};const root=createRoot(document.getElementById('root'));window.mountPrint=(version=1)=>root.render(React.createElement(PrintButton,{orderId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'cashier',version,isTestOrder:true}));window.mountPrint();`);
 const aliases={'../receipt-actions':'actions.cjs','@/components/pos/thermal-receipt':'thermal-receipt.cjs','@/lib/pos/receipt':'receipt.cjs','./point-simulation.ts':'point-simulation.cjs','./thermal-receipt.css':'empty.cjs'};
 await new Promise<void>((resolve,reject)=>{const compiler=webpack({mode:'production',optimization:{minimize:false},entry:path.join(fixtureDir,'entry.js'),output:{path:fixtureDir,filename:'bundle.js'},resolve:{modules:[path.resolve('node_modules'),'node_modules'],alias:Object.fromEntries(Object.entries(aliases).map(([key,file])=>[key,path.join(fixtureDir,file)]))}});compiler.run((error:Error|null,stats:any)=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString())):resolve()));});
});
async function mount(page:Page,width=390){
 page.on('pageerror',error=>{throw error;});await page.setViewportSize({width,height:900});
 await page.route('https://receipt.test/',route=>route.fulfill({body:'<div></div>',contentType:'text/html'}));await page.goto('https://receipt.test/');
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
 for(const value of ['MasJawa Laundry','NOTA UJI - SIMULASI','BUKAN BUKTI PEMBAYARAN NYATA','1,25 kg','2,35 m','3 pcs','Kasir : Kasir Uji','19:09 WIB','Sisa Tagihan :','Rp61.300'])await expect(print).toContainText(value);
 const size=await print.locator('.thermal-receipt').boundingBox();expect(size!.width).toBeCloseTo((roll===58?50:70)*96/25.4,0);
 expect(await print.locator('.thermal-receipt').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 const amounts=await print.locator('.thermal-nominal').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().right));expect(Math.max(...amounts)-Math.min(...amounts)).toBeLessThan(1);
 await expect(print).not.toContainText('Bank rahasia');await expect(print).toContainText('1. Pengaduan Komplain max 1x24 jam.');await expect(print).not.toContainText('Ketentuan panjang');
 await page.pdf({path:`artifacts/pos-v3-thermal-${roll}.pdf`,width:`${roll}mm`,height:`${Math.ceil(size!.height*25.4/96)+4}mm`,printBackground:true});
 mkdirSync('artifacts/screenshots',{recursive:true});await page.screenshot({path:`artifacts/screenshots/pos-v3-thermal-${roll}.png`,clip:{x:0,y:0,width:Math.ceil(roll*96/25.4),height:Math.ceil(size!.height)+8}});
});
test('failed reads are recoverable and rereads fetch new payment state without creating transactions',async({page})=>{
 await mount(page);await page.evaluate(()=>{(window as any).failRead=true;});await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await expect(page.getByRole('alert')).toContainText('Koneksi terputus');await expect(page.getByRole('button',{name:'Cetak nota 58 mm',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{(window as any).failRead=false;});await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await expect(page.getByRole('status')).toContainText('siap dicetak');
 await page.evaluate(()=>{Object.assign((window as any).receipt,{status:'REFUNDED',paid:'71300',refunded:'71300',remaining:'0',payments:[{...((window as any).receipt.payments[0]),amount_idr:'71300'}],refunds:[{...((window as any).receipt.payments[0]),amount_idr:'71300'}]});});await page.getByRole('button',{name:'Baca ulang nota cetak'}).click();
 await page.emulateMedia({media:'print'});const print=page.locator('body > .thermal-print-root');await expect(print).toContainText('REFUND');await expect(print).toContainText('Sisa Tagihan : Rp0');await expect(print).toContainText('Tidak ada tagihan baru');
 expect(await page.evaluate(()=>(window as any).reads)).toEqual(Array.from({length:3},()=>['cashier','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']));expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);
});

for(const roll of [58,80])for(const state of ['PAID','REFUNDED','CANCELLED'])test(`changed ${state} ${roll}mm state requires another print confirmation`,async({page})=>{
 await mount(page);await page.getByLabel('Lebar kertas').selectOption(String(roll));await page.getByRole('button',{name:'Siapkan cetak nota'}).click();
 await page.evaluate(status=>{Object.assign((window as any).receipt,{payment_version:'2',status:status==='CANCELLED'?'UNPAID':status,work_status:status==='CANCELLED'?'CANCELLED':'QUEUED',paid:status==='CANCELLED'?'0':'71300',refunded:status==='REFUNDED'?'71300':'0',remaining:'0',payments:status==='CANCELLED'?[]:[{amount_idr:'71300',received_at:'2026-11-06T00:00:00Z',receiver:'Owner',method:'CASH'}],refunds:status==='REFUNDED'?[{amount_idr:'71300',received_at:'2026-11-06T00:00:00Z',receiver:'Owner',method:'CASH'}]:[]});},state);
 await page.getByRole('button',{name:`Cetak nota ${roll} mm`,exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('berubah');expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);
 await page.getByRole('button',{name:`Cetak nota ${roll} mm`,exact:true}).click();expect(await page.evaluate(()=>(window as any).printCalls)).toBe(1);
 expect(await page.evaluate(()=>(window as any).printed)).toContain(state==='PAID'?'LUNAS':state==='REFUNDED'?'REFUND':'DIBATALKAN');
 await expect(page.locator('.thermal-print-root')).toContainText(state==='PAID'?'LUNAS':state==='REFUNDED'?'REFUND':'DIBATALKAN');
 await page.emulateMedia({media:'print'});await page.locator('.thermal-print-root .thermal-receipt').screenshot({path:`artifacts/screenshots/pos-v31-${state}-${roll}.png`});
});
test('failed final verification never prints cached preview',async({page})=>{
 await mount(page);await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await page.evaluate(()=>{(window as any).failRead=true;});
 await page.getByRole('button',{name:'Cetak nota 58 mm',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);
 await expect(page.locator('.thermal-print-root')).toHaveCount(0);
});
test('device paper profile persists and rejects unknown storage values',async({page})=>{
 await mount(page);await page.getByLabel('Lebar kertas').selectOption('80');expect(await page.evaluate(()=>localStorage.getItem('masjawa.thermal-width'))).toBe('80');
 await mount(page);await expect(page.getByLabel('Lebar kertas')).toHaveValue('80');await page.evaluate(()=>localStorage.setItem('masjawa.thermal-width','999'));await mount(page);await expect(page.getByLabel('Lebar kertas')).toHaveValue('58');
});

test('late preparation cannot restore a receipt after order version changes',async({page})=>{
 await mount(page);await page.evaluate(()=>{(window as any).holdRead=true;});await page.getByRole('button',{name:'Siapkan cetak nota'}).click();
 await page.evaluate(()=>{(window as any).mountPrint(2);});await expect(page.getByRole('button',{name:'Siapkan cetak nota'})).toBeEnabled();await page.evaluate(()=>{(window as any).releaseRead();});
 await expect(page.getByRole('button',{name:'Siapkan cetak nota'})).toBeEnabled();await expect(page.locator('.thermal-print-root')).toHaveCount(0);
});
test('thermal uses canonical units, readable actor, long notes and large money',async({page})=>{
 await mount(page);await page.evaluate(()=>{Object.assign((window as any).receipt,{actor:'Owner',notes:'Catatan panjang '.repeat(30),total:'997500000000000',service_subtotal:'997500000000000',payments:[],paid:'0',remaining:'997500000000000',status:'UNPAID',items:[{name:'Layanan panjang '.repeat(20),package:'Kilat',duration:null,quantity_milli:2375,unit:'kg',price:'420000000000000',subtotal:'997500000000000'}]});});
 await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await page.getByRole('button',{name:'Cetak nota 58 mm',exact:true}).click();await page.emulateMedia({media:'print'});
 const print=page.locator('.thermal-print-root');await expect(print).toContainText('2,375 kg');await expect(print).toContainText('Kasir : Owner');await expect(print).not.toContainText('12345678-1234');await expect(print).toContainText('Rp997.500.000.000.000');expect(await print.locator('.thermal-receipt').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
});

for(const roll of [58,80])test(`single service ${roll}mm preserves 0.75kg and unpaid amount`,async({page})=>{
 await mount(page);await page.getByLabel('Lebar kertas').selectOption(String(roll));
 await page.evaluate(()=>{const r=(window as any).receipt;Object.assign(r,{items:[{...r.items[0],quantity_milli:750,subtotal:'4500'}],service_subtotal:'4500',total:'4500',paid:'0',remaining:'4500',status:'UNPAID',payments:[]});});
 await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await page.getByRole('button',{name:`Cetak nota ${roll} mm`,exact:true}).click();
 await page.emulateMedia({media:'print'});const print=page.locator('.thermal-print-root .thermal-receipt');await expect(print).toContainText('0,75 kg');await expect(print).toContainText('BELUM BAYAR');await expect(print).toContainText('Sisa Tagihan : Rp4.500');await print.screenshot({path:`artifacts/screenshots/pos-v31-single-${roll}.png`});
});
test('a late final verification cannot print after order version changes',async({page})=>{
 await mount(page);await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await page.evaluate(()=>{(window as any).holdRead=true;});await page.getByRole('button',{name:'Cetak nota 58 mm',exact:true}).click();
 await page.evaluate(()=>{(window as any).mountPrint(2);});await expect(page.getByRole('button',{name:'Siapkan cetak nota'})).toBeEnabled();await page.evaluate(()=>{(window as any).releaseRead();});await expect(page.getByRole('button',{name:'Siapkan cetak nota'})).toBeEnabled();expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);await expect(page.locator('.thermal-print-root')).toHaveCount(0);
});

test('fresh snapshot and simulation calculation timestamps do not block an unchanged pilot receipt',async({page})=>{
 await mount(page);
 await page.evaluate(()=>{(window as any).receipt.point_simulation={booked:false,total_idr:'71300',paid_idr:'10000',refunded_idr:'0',points:5,rule_available:true,program_year:2026,rule_revision:2,state:'PARTIAL',persisted_order:true,calculated_at:'2026-11-06T00:00:00Z'};});
 await page.getByRole('button',{name:'Siapkan cetak nota'}).click();
 await page.evaluate(()=>{const r=(window as any).receipt;r.snapshot_at='2026-11-06T00:01:00Z';r.point_simulation.calculated_at='2026-11-06T00:01:00Z';});
 await page.getByRole('button',{name:'Cetak nota 58 mm',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).printCalls)).toBe(1);await expect(page.getByRole('alert')).toHaveCount(0);
});
for(const field of ['points','rule_revision','program_year'])test(`changed simulation ${field} still requires preview confirmation`,async({page})=>{
 await mount(page);await page.evaluate(()=>{(window as any).receipt.point_simulation={booked:false,total_idr:'71300',paid_idr:'10000',refunded_idr:'0',points:5,rule_available:true,program_year:2026,rule_revision:2,state:'PARTIAL',persisted_order:true,calculated_at:'2026-11-06T00:00:00Z'};});
 await page.getByRole('button',{name:'Siapkan cetak nota'}).click();await page.evaluate(key=>{const r=(window as any).receipt;r.snapshot_at='2026-11-06T00:01:00Z';r.point_simulation.calculated_at='2026-11-06T00:01:00Z';r.point_simulation[key]++;},field);
 await page.getByRole('button',{name:'Cetak nota 58 mm',exact:true}).click();expect(await page.evaluate(()=>(window as any).printCalls)).toBe(0);await expect(page.getByRole('alert')).toContainText('berubah');
});
