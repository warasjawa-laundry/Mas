import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const fixtureRequire=createRequire(process.cwd()+'/package.json');
const webpack=fixtureRequire('next/dist/compiled/webpack/webpack-lib');
const fixtureDir=path.resolve('test-results/pos-wizard-fixture');
const bundle=path.join(fixtureDir,'bundle.js');
const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const services=[
 {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',category:'Kiloan',package_name:'Express',name:'Cuci Express',price_idr:6000,unit:'kg',duration:'6 jam',revision:3,duration_package_code:'EXPRESS'},
 {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',category:'Satuan',package_name:'Reguler',name:'Setrika Satuan',price_idr:4000,unit:'pcs',duration:'2 hari',revision:7,duration_package_code:'REGULAR'},
];
const cssSource=readFileSync('app/kasir/pesanan/baru/wizard.module.css','utf8');
const classNames=[...new Set([...cssSource.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(x=>x[1]))];
const classMap=Object.fromEntries(classNames.map(name=>[name,'posFixture_'+name]));
const fixtureCss=cssSource.replace(/\.([a-zA-Z_][\w-]*)/g,(match,name)=>classMap[name]?'.'+classMap[name]:match);

test.describe.configure({mode:'serial'});
test.beforeAll(async()=>{
 mkdirSync(fixtureDir,{recursive:true});
 const files:Record<string,string>={
  'order-form':'app/kasir/pesanan/baru/order-form.tsx',
  'recoverable-form':'components/admin/recoverable-form.tsx',
  money:'lib/pos/money.ts','catalog-units':'lib/pos/catalog-units.ts',
  'ui-quantity':'lib/pos/ui-quantity.ts','g4-order':'lib/pos/g4-order.ts',
  'command-recovery':'lib/pos/command-recovery.ts',eta:'lib/pos/eta.ts',
 };
 for(const [name,file] of Object.entries(files))writeFileSync(path.join(fixtureDir,name+'.cjs'),ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 writeFileSync(path.join(fixtureDir,'styles.cjs'),'exports.default='+JSON.stringify(classMap));
 writeFileSync(path.join(fixtureDir,'controls.cjs'),`
 exports.MemberNamePicker=()=>null;exports.CashierQrScanner=()=>null;
 const state=window.posFixture={lookups:[],creates:[],successes:0};
 const lookup=(role,number)=>new Promise(resolve=>state.lookups.push({role,number,resolve}));
 exports.resolveOwnerPosMemberCode=number=>lookup('owner',number);
 exports.resolveCashierMemberCode=number=>lookup('cashier',number);
 exports.createCashierOrder=async data=>{
  state.creates.push(Object.fromEntries(data.entries()));
  await new Promise(resolve=>state.finishCreate=resolve);
  if(state.creates.length===1)return {error:'Nota belum terkonfirmasi. Coba kembali dengan ID sama.'};
  state.successes++;return {error:'Nota fixture terkonfirmasi.'};
 };
 `);
 writeFileSync(path.join(fixtureDir,'entry.js'),`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {OrderForm} from './order-form.cjs';
 const role=window.posFixtureRole||'cashier';
 createRoot(document.getElementById('root')).render(React.createElement(OrderForm,{services:${JSON.stringify(services)},requestId:${JSON.stringify(requestId)},canWrite:true,canLookup:true,role,serverTime:"2026-12-31T16:30:00.000Z",packageWorkflow:window.posPackageWorkflow||false}));
 `);
 const alias:Record<string,string>={
  'next/navigation':path.resolve('tests/pos-fixture-navigation.cjs'),
  './wizard.module.css':path.join(fixtureDir,'styles.cjs'),
  '../actions':path.join(fixtureDir,'controls.cjs'),
  './member-name-picker':path.join(fixtureDir,'controls.cjs'),
  './cashier-qr-scanner':path.join(fixtureDir,'controls.cjs'),
  './qr-actions':path.join(fixtureDir,'controls.cjs'),
  '@/app/admin/pesanan/member-actions':path.join(fixtureDir,'controls.cjs'),
  '@/components/admin/recoverable-form':path.join(fixtureDir,'recoverable-form.cjs'),
 };
 for(const name of ['money','catalog-units','ui-quantity','g4-order','command-recovery','eta'])alias['@/lib/pos/'+name]=path.join(fixtureDir,name+'.cjs');
 await new Promise<void>((resolve,reject)=>{
  const compiler=webpack({mode:'production',optimization:{minimize:false},entry:path.join(fixtureDir,'entry.js'),output:{path:fixtureDir,filename:'bundle.js'},resolve:{modules:[path.resolve('node_modules'),'node_modules'],alias}});
  compiler.run((error:Error|null,stats:{hasErrors:()=>boolean;toString:()=>string})=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString())):resolve()));
 });
});

async function mount(page:Page,width=390,role='cashier',packageWorkflow=false){
 page.on('pageerror',error=>{throw error});
 await page.setViewportSize({width,height:900});
 await page.route('**/*',route=>route.abort());
 await page.setContent(`<style>:root{--font-pos:Arial}body{margin:0;background:#f8f8f9}${fixtureCss}</style><main class="${classMap.shell}"><div id="root"></div></main>`);
 await page.evaluate(value=>{(window as any).posFixtureRole=value},role);
 await page.evaluate(value=>{(window as any).posPackageWorkflow=value},packageWorkflow);
 await page.addScriptTag({path:bundle});
 await expect(page.getByRole('heading',{name:'Pilih pelanggan',exact:true})).toBeVisible();
}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)}
async function selectServices(page:Page,width:number){
 if(width<1024)await page.getByRole('button',{name:'Lanjut',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Pilih layanan & durasi',exact:true})).toBeVisible();
 await page.getByLabel('Jumlah Cuci Express',{exact:true}).fill('1.25');
 await page.getByLabel('Jumlah Setrika Satuan',{exact:true}).fill('2');
 await expect(page.locator('.'+classMap.serviceDuration).first()).toContainText('6 jam');
 await expect(page.locator('.'+classMap.serviceDuration).last()).toContainText('2 hari');
 await noOverflow(page);
 await page.screenshot({path:`artifacts/screenshots/pos-wizard-services-${width}.png`,fullPage:true});
 if(width<1024)await page.getByRole('button',{name:'Atur pesanan',exact:true}).click();
}

for(const width of [320,390,1440])test(`guest journey, exact mixed-duration total and stable retry at ${width}px`,async({page})=>{
 await mount(page,width);
 if(width<1024)await expect(page.getByRole('button',{name:'Lanjut',exact:true})).toBeDisabled();
 await page.getByLabel('Nama pelanggan').fill('Pelanggan Fixture');
 await noOverflow(page);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:`artifacts/screenshots/pos-wizard-customer-${width}.png`,fullPage:true});
 await selectServices(page,width);
 const summary=page.getByRole('complementary');
 await expect(summary).toBeVisible();
 await expect(summary).toContainText('Cuci Express · Express');
 await expect(summary).toContainText('6 jam · 1.25 kg');
 await expect(summary).toContainText('2 hari · 2 pcs');
 await expect(summary.locator('.'+classMap.total)).toHaveText(/Total tagihanRp\s*15\.500/);
 await page.getByLabel('Parfum (opsional)').fill('Tanpa parfum');
 await page.getByLabel('Catatan cucian (opsional)').fill('Pisahkan warna');
 await noOverflow(page);
 await page.getByRole('button',{name:'Buat pesanan',exact:true}).click();
 await expect(page.getByRole('button',{name:'Menyimpan pesanan…',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Menyimpan pesanan…',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click()});
 expect(await page.evaluate(()=>(window as any).posFixture.creates.length)).toBe(1);
 await page.evaluate(()=>(window as any).posFixture.finishCreate());
 await expect(page.getByRole('alert')).toContainText('Nota belum terkonfirmasi');
 await expect(page.locator('[name=requestId]')).toHaveValue(requestId);
 await expect(page.getByLabel('Parfum (opsional)')).toHaveValue('Tanpa parfum');
 await expect(page.getByLabel('Catatan cucian (opsional)')).toHaveValue('Pisahkan warna');
 const first=await page.evaluate(()=>(window as any).posFixture.creates[0]);
 expect(JSON.parse(first.items)).toEqual(services.map((s,i)=>({service_id:s.id,quantity:i?'2':'1.25',revision:s.revision})));
 await page.getByRole('button',{name:'Buat pesanan',exact:true}).click();
 await expect(page.getByRole('button',{name:'Menyimpan pesanan…',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>(window as any).posFixture.creates)).toEqual([first,first]);
 await page.evaluate(()=>(window as any).posFixture.finishCreate());
 await expect(page.getByRole('alert')).toContainText('Nota fixture terkonfirmasi');
 expect(await page.evaluate(()=>(window as any).posFixture.successes)).toBe(1);
 expect(await page.evaluate(()=>(window as any).posFixture.creates.length)).toBe(2);
 await noOverflow(page);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:`artifacts/screenshots/pos-wizard-${width}.png`,fullPage:true});
});

for(const role of ['cashier','owner'])test(`${role}: manual identity requires lookup, editing clears it, stale responses cannot select another person`,async({page})=>{
 await mount(page,390,role);
 await page.getByRole('radio',{name:'Member MJL',exact:true}).check();
 const number=page.getByLabel('Nomor member',{exact:true});
 const next=page.getByRole('button',{name:'Lanjut',exact:true});
 await number.fill('101');await expect(next).toBeDisabled();
 await page.getByRole('button',{name:'Periksa nomor member',exact:true}).click();
 await expect(next).toBeDisabled();
 await page.evaluate(()=>(window as any).posFixture.lookups[0].resolve(null));
 await expect(page.getByRole('alert')).toContainText('Member aktif tidak ditemukan');
 await expect(next).toBeDisabled();
 await page.getByRole('button',{name:'Periksa nomor member',exact:true}).click();
 await page.evaluate(()=>(window as any).posFixture.lookups[1].resolve({memberNumber:'101',displayName:'Anggota Satu'}));
 await expect(page.getByRole('status')).toContainText('Anggota Satu');await expect(next).toBeEnabled();
 await number.fill('202');await expect(next).toBeDisabled();
 await expect(page.getByRole('status')).toHaveCount(0);
 await page.getByRole('button',{name:'Periksa nomor member',exact:true}).click();
 await number.fill('303');await expect(next).toBeDisabled();
 await page.getByRole('button',{name:'Periksa nomor member',exact:true}).click();
 await page.evaluate(()=>(window as any).posFixture.lookups[3].resolve({memberNumber:'303',displayName:'Anggota Tiga'}));
 await expect(page.getByRole('status')).toContainText('Anggota Tiga');
 await page.evaluate(()=>(window as any).posFixture.lookups[2].resolve({memberNumber:'202',displayName:'Anggota Lama'}));
 await expect(number).toHaveValue('303');
 await expect(page.getByRole('status')).toContainText('Anggota Tiga');
 await expect(page.getByText('Anggota Lama',{exact:true})).toHaveCount(0);
 await expect(next).toBeEnabled();
 await next.click();await expect(page.getByRole('heading',{name:'Pilih layanan & durasi'})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).posFixture.lookups.map((lookup:any)=>lookup.role))).toEqual([role,role,role,role]);
});

for(const width of [320,390,1440])test(`package workflow has four steps, filters tariffs and confirms a package change at ${width}px`,async({page})=>{
 await mount(page,width,'owner',true);
 await page.getByLabel('Nama pelanggan').fill('Pelanggan Paket QA');
 if(width<1024)await page.getByRole('button',{name:'Lanjut',exact:true}).click();
 await page.getByLabel('Reguler · 2 hari',{exact:true}).check();
 await expect(page.getByLabel('Estimasi selesai').first()).toHaveText('02/01/2027 - 23:30 WIB');
 if(width<1024)await page.getByRole('button',{name:'Lanjut',exact:true}).click();
 await expect(page.getByLabel('Jumlah Cuci Express',{exact:true})).toHaveCount(0);
 await page.getByLabel('Jumlah Setrika Satuan',{exact:true}).fill('2');
 if(width<1024)await page.getByRole('button',{name:'Kembali',exact:true}).click();
 await page.getByLabel('Express · 6 jam',{exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('mengosongkan pilihan layanan');
 await expect(page.locator('[name=items]')).toHaveValue(/cccccccc/);
 await page.getByRole('button',{name:'Pertahankan pilihan',exact:true}).click();
 await expect(page.getByLabel('Reguler · 2 hari',{exact:true})).toBeChecked();
 await page.getByLabel('Express · 6 jam',{exact:true}).click();
 await page.getByRole('button',{name:'Ganti paket dan pilih ulang',exact:true}).click();
 await expect(page.getByLabel('Estimasi selesai').first()).toHaveText('01/01/2027 - 05:30 WIB');
 await expect(page.locator('[name=items]')).toHaveValue('[]');
 if(width<1024)await page.getByRole('button',{name:'Lanjut',exact:true}).click();
 await expect(page.getByLabel('Jumlah Setrika Satuan',{exact:true})).toHaveCount(0);
 await page.getByLabel('Jumlah Cuci Express',{exact:true}).fill('1.25');
 if(width<1024)await page.getByRole('button',{name:'Atur pesanan',exact:true}).click();
 await expect(page.getByRole('complementary').locator('.'+classMap.total)).toHaveText(/Total tagihanRp\s*7\.500/);
 await noOverflow(page);
 await page.getByRole('button',{name:'Buat pesanan',exact:true}).click();
 const payload=await page.evaluate(()=>(window as any).posFixture.creates[0]);
 expect(JSON.parse(payload.items)).toEqual([{service_id:services[0].id,revision:3,quantity:'1.25'}]);
 await page.evaluate(()=>(window as any).posFixture.finishCreate());
 await expect(page.getByRole('alert')).toContainText('Nota belum terkonfirmasi');
 await page.screenshot({path:`artifacts/screenshots/pos-package-wizard-${width}.png`,fullPage:true});
});
