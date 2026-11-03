import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const req=createRequire(process.cwd()+'/package.json'),webpack=req('next/dist/compiled/webpack/webpack-lib');
const dir=path.resolve('test-results/pos-wa-fixture'),bundle=path.join(dir,'bundle.js');
test.beforeAll(async()=>{
 mkdirSync(dir,{recursive:true});
 for(const [name,file] of Object.entries({notice:'components/pos/test-order-notice.tsx',charges:'components/pos/order-charges.tsx',g4:'lib/pos/g4-order.ts',money:'lib/pos/money.ts',units:'lib/pos/catalog-units.ts',recovery:'lib/pos/command-recovery.ts',draft:'app/kasir/pesanan/[id]/whatsapp-draft.tsx',receipt:'lib/pos/receipt.ts',form:'components/admin/recoverable-form.tsx',pending:'components/admin/pending-submit.tsx'}))writeFileSync(path.join(dir,name+'.cjs'),ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 writeFileSync(path.join(dir,'styles.cjs'),'exports.default=new Proxy({},{get:(_,key)=>key});');
 writeFileSync(path.join(dir,'commands.cjs'),`const {buildReceipt}=require('./receipt.cjs');
 exports.prepareOrderReceipt=async(role,id,kind)=>{window.reads++;const data={...window.receipt,kind};return {error:'',data,text:buildReceipt(data)}};
 exports.verifyOrderContact=async()=>({error:'Fixture never verifies real customer data'});`);
 writeFileSync(path.join(dir,'entry.js'),`import React from 'react';import {createRoot} from 'react-dom/client';import {WhatsAppDraft} from './draft.cjs';import TestOrderNotice from './notice.cjs';import OrderCharges from './charges.cjs';
 window.reads=0;if(window.receipt.is_test_order){const node=document.createElement('div');document.body.appendChild(node);createRoot(node).render(React.createElement(TestOrderNotice,{isTestOrder:true}));const costs=document.createElement('div');document.body.appendChild(costs);createRoot(costs).render(React.createElement(OrderCharges,{subtotal:'4000',total:'7000',delivery:{code:'NEAR',name:'Dekat',amount_idr:'3000'}}));}createRoot(document.getElementById('root')).render(React.createElement(WhatsAppDraft,{orderId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'owner',workStatus:'READY',version:1,isTestOrder:window.receipt.is_test_order===true}));`);
 const alias={'@/app/kasir/pesanan/orders.module.css':path.join(dir,'styles.cjs'),'@/lib/pos/g4-order':path.join(dir,'g4.cjs'),'@/lib/pos/money':path.join(dir,'money.cjs'),'@/lib/pos/catalog-units':path.join(dir,'units.cjs'),'next/navigation':path.resolve('tests/pos-fixture-navigation.cjs'),'../receipt-actions':path.join(dir,'commands.cjs'),
 '../orders.module.css':path.join(dir,'styles.cjs'),'@/lib/pos/receipt':path.join(dir,'receipt.cjs'),'@/lib/pos/command-recovery':path.join(dir,'recovery.cjs'),
 '@/components/admin/recoverable-form':path.join(dir,'form.cjs'),'@/components/admin/pending-submit':path.join(dir,'pending.cjs')};
 await new Promise<void>((resolve,reject)=>{const compiler=webpack({mode:'production',optimization:{minimize:false},entry:path.join(dir,'entry.js'),output:{path:dir,filename:'bundle.js'},resolve:{modules:[path.resolve('node_modules'),'node_modules'],alias}});compiler.run((error:Error|null,stats:any)=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString())):resolve()));});
});
for(const width of [320,390,1440])test(`WhatsApp reads fresh DP/settled points and requires verified recipient at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});page.on('pageerror',error=>{throw error});

 const css=readFileSync('app/kasir/pesanan/orders.module.css','utf8');
 await page.route('**/*',route=>route.request().url()==='http://127.0.0.1:3000/receipt-fixture'?route.fulfill({contentType:'text/html',body:`<style>body{margin:0;font-family:Arial}*{box-sizing:border-box}${css}</style><main class="shell"><div id="root"></div></main>`}):route.abort());
 await page.goto('http://127.0.0.1:3000/receipt-fixture');
 await page.evaluate(()=>{(window as any).receipt={invoice:'MJL-QA-001',customer:'QA Customer',actor:'QA Kasir',created_at:'2026-11-01T12:09:00Z',due_at:'2026-11-04T12:09:00Z',ready_at:'2026-11-04T12:00:00Z',collected_at:null,work_status:'READY',package:'Reguler',minutes:4320,perfume:'Sakura',notes:null,total:'19600',paid:'10000',refunded:'0',remaining:'9600',status:'PARTIAL',contact:null,member:{year:2026,balance:'8',awarded:0,projected:1},settings:{revision:1,config:{outlet_name:'QA Laundry',address:'QA',contact:'QA',ready_title:'SIAP DIAMBIL',new_title:'',collected_title:'SUDAH DIAMBIL',terms:'Ketentuan QA',payment_notice:'Pembayaran di awal',bank:'Bank QA',ewallet:'Wallet QA',cs:'CS QA'}},items:[{name:'Setrika',package:'Reguler',duration:'4320 menit',quantity_milli:4900,unit:'kg',price:'4000',subtotal:'19600'}]};});
 await page.addScriptTag({path:bundle});
 await page.getByRole('button',{name:'Baca draf Siap Diambil',exact:true}).click();
 await expect(page.locator('pre')).toContainText('Sisa Tagihan : Rp9.600');await expect(page.locator('pre')).toContainText('Total Poin Aktif : 8 poin');
 await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
 await page.evaluate(()=>{const r=(window as any).receipt;r.paid='19600';r.remaining='0';r.status='PAID';r.member={year:2026,balance:'9',awarded:1,projected:null};r.contact={phone:'+6280000000000',address:'Alamat QA',verified_at:'2026-11-01T12:09:00Z'};});
 await page.getByRole('button',{name:'Baca draf Siap Diambil',exact:true}).click();
 await expect(page.locator('pre')).toContainText('Sisa Tagihan : Rp0');await expect(page.locator('pre')).toContainText('Total Poin Aktif : 9 poin');
 await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
 await page.getByRole('checkbox',{name:/Saya memeriksa penerima/}).check();
 await expect(page.getByRole('link',{name:'Buka WhatsApp — kirim manual'})).toHaveAttribute('href',/^https:\/\/wa.me\/6280000000000\?text=/);
 expect(await page.evaluate(()=>(window as any).reads)).toBe(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 mkdirSync('artifacts/screenshots',{recursive:true});await page.screenshot({path:`artifacts/screenshots/pos-whatsapp-${width}.png`,fullPage:true});
});

for(const width of [320,1440])test(`pilot receipt stays marked in print and cannot open WhatsApp at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});page.on('pageerror',error=>{throw error});
 const css=readFileSync('app/kasir/pesanan/orders.module.css','utf8');
 await page.route('**/*',route=>route.request().url()==='http://127.0.0.1:3000/receipt-fixture'?route.fulfill({contentType:'text/html',body:`<style>body{margin:0;font-family:Arial}*{box-sizing:border-box}${css}</style><main class="shell"><div id="root"></div></main>`}):route.abort());
 await page.goto('http://127.0.0.1:3000/receipt-fixture');
 await page.evaluate(()=>{(window as any).receipt={is_test_order:true,invoice:'MJL-QA-TEST',customer:'uji - QA Guest',actor:'QA Owner',created_at:'2026-11-03T10:00:00Z',due_at:null,ready_at:null,collected_at:null,work_status:'READY',package:'QA',minutes:360,perfume:null,notes:null,total:'7000',service_subtotal:'4000',fees_idr:'3000',discount_idr:'0',delivery:{code:'NEAR',name:'Dekat',amount_idr:'3000'},paid:'7000',refunded:'0',remaining:'0',status:'PAID',contact:{phone:'+6280000000000',address:'QA address',verified_at:'2026-11-03T10:00:00Z'},member:null,settings:{revision:1,config:{outlet_name:'QA Laundry',address:'QA',contact:'QA',new_title:'QA',ready_title:'QA',collected_title:'QA',terms:'QA terms',payment_notice:'Bayar sungguhan',bank:'Bank QA',ewallet:'Wallet QA',cs:'QA CS'}},items:[{name:'QA service',package:'QA',duration:'6 jam',quantity_milli:1000,unit:'kg',price:'4000',subtotal:'4000'}]};});
 await page.addScriptTag({path:bundle});
 await expect(page.getByText('Verifikasi nomor & alamat penerima',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Baca draf Nota Baru',exact:true}).click();
 await expect(page.locator('pre')).toContainText('BUKAN BUKTI PEMBAYARAN NYATA');
 await expect(page.locator('pre')).not.toContainText('Bank QA');
 await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
 await expect(page.getByRole('group',{name:'Rincian biaya'})).toContainText(/Subtotal layananRp\s*4\.000/);
 await expect(page.getByRole('group',{name:'Rincian biaya'})).toContainText(/Antar-jemput \(Dekat\)Rp\s*3\.000/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.emulateMedia({media:'print'});
 await expect(page.getByRole('note',{name:'Nota uji'})).toBeVisible();
 await page.screenshot({path:`artifacts/screenshots/pos-pilot-print-${width}.png`,fullPage:true});
});
