import {test,expect,type Page} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const req='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const newReq='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key='mjl:pending:v1:cashier:actor-fixture:PAYMENT:order-fixture';
const fixtureRequire=createRequire(process.cwd()+'/package.json');
const webpack=fixtureRequire('next/dist/compiled/webpack/webpack-lib');
const dir=path.resolve('test-results/command-recovery-fixture');
let script='';
test.describe.configure({mode:'serial'});
test.beforeAll(async()=>{
 mkdirSync(dir,{recursive:true});
 for(const [name,file] of Object.entries({form:'components/admin/recoverable-form.tsx',pending:'components/admin/pending-submit.tsx',recovery:'lib/pos/command-recovery.ts'}))
  writeFileSync(path.join(dir,name+'.cjs'),ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 writeFileSync(path.join(dir,'entry.js'),`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import Form from './form.cjs';import Pending from './pending.cjs';
 const params=new URLSearchParams(location.search);
 const key=${JSON.stringify(key)}+(params.get('otherActor')?':other':'');
 const state=window.fixture={creates:[],lookups:[],lookupResult:{error:'Hasil belum ditemukan. Transaksi mungkin masih berjalan.'},transportError:false};
 const action=async data=>{state.creates.push(Object.fromEntries(data));await new Promise(resolve=>state.finishCreate=resolve);if(state.transportError)throw Error('offline');return {error:'Hasil belum terkonfirmasi'};};
 const recover=async request=>{state.lookups.push(request);return state.lookupResult;};
 createRoot(document.getElementById('root')).render(React.createElement(Form,{action,recoveryKey:key,recoverAction:recover},
 React.createElement('input',{name:'requestId',type:'hidden',value:params.get('refresh')?${JSON.stringify(newReq)}:${JSON.stringify(req)}}),
 React.createElement('label',null,'Nama',React.createElement('input',{name:'customer',required:true})),
 React.createElement('label',null,'Nominal',React.createElement('input',{name:'amount',required:true})),
 React.createElement(Pending,{label:'Kirim'})));
 `);
 await new Promise<void>((resolve,reject)=>{
  const compiler=webpack({mode:'production',optimization:{minimize:false},entry:path.join(dir,'entry.js'),output:{path:dir,filename:'bundle.js'},resolve:{modules:[path.resolve('node_modules'),'node_modules'],alias:{'@/lib/pos/command-recovery':path.join(dir,'recovery.cjs'),'next/navigation':path.resolve('tests/pos-fixture-navigation.cjs')}}});
  compiler.run((error:Error|null,stats:{hasErrors:()=>boolean;toString:()=>string})=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString())):resolve()));
 });
 script=readFileSync(path.join(dir,'bundle.js'),'utf8');
});
async function mount(page:Page){
 page.on('pageerror',error=>{throw error});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='fixture.test')return route.abort();
  return route.fulfill({contentType:url.pathname==='/bundle.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8',body:url.pathname==='/bundle.js'?script:'<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>'});
 });
 await page.goto('http://fixture.test/');
 await expect(page.getByRole('button',{name:'Kirim',exact:true})).toBeEnabled();
}
async function submitUnknown(page:Page){
 await page.getByLabel('Nama',{exact:true}).fill('Nama rahasia fixture');
 await page.getByLabel('Nominal',{exact:true}).fill('63000');
 await page.getByRole('button',{name:'Kirim',exact:true}).click();
 await expect(page.getByRole('button',{name:'Menyimpan…',exact:true})).toBeDisabled();
 await page.evaluate(()=>(window as any).fixture.finishCreate());
 await expect(page.getByRole('alert')).toContainText('belum terkonfirmasi');
}

test('refresh restores only UUID, blocks a fresh command and permits same-ID reconstruction after inconclusive lookup',async({page})=>{
 await mount(page);await submitUnknown(page);
 expect(await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage)))).toEqual({[key]:req});
 await page.goto('http://fixture.test/?refresh=1');
 await expect(page.getByRole('status')).toContainText('Formulir baru dikunci');
 await expect(page.getByRole('button',{name:'Kirim',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Nama',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Nominal',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Periksa hasil transaksi',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('mungkin masih berjalan');
 expect(await page.evaluate(()=>(window as any).fixture.lookups)).toEqual([req]);
 expect(await page.evaluate(storageKey=>sessionStorage.getItem(storageKey),key)).toBe(req);
 await expect(page.getByRole('button',{name:'Kirim',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Susun ulang dengan ID yang sama',exact:true}).click();
 await page.getByLabel('Nama',{exact:true}).fill('Nama rahasia fixture');
 await page.getByLabel('Nominal',{exact:true}).fill('63000');
 await page.getByRole('button',{name:'Kirim',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).fixture.creates)).toEqual([{requestId:req,customer:'Nama rahasia fixture',amount:'63000'}]);
 await page.evaluate(()=>(window as any).fixture.finishCreate());
 await expect(page.getByRole('alert')).toContainText('belum terkonfirmasi');
});

test('reauth lookup failure retains the marker; only confirmed lookup clears it',async({page})=>{
 await mount(page);await submitUnknown(page);await page.reload();
 await page.evaluate(()=>{(window as any).fixture.lookupResult={error:'Masuk kembali sebagai kasir yang sama.'}});
 await page.getByRole('button',{name:'Periksa hasil transaksi',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Masuk kembali');
 expect(await page.evaluate(storageKey=>sessionStorage.getItem(storageKey),key)).toBe(req);
 await page.evaluate(()=>{(window as any).fixture.lookupResult={error:'',confirmed:true}});
 await page.getByRole('button',{name:'Periksa hasil transaksi',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('dikonfirmasi database');
 expect(await page.evaluate(storageKey=>sessionStorage.getItem(storageKey),key)).toBeNull();
 await expect(page.getByRole('button',{name:'Kirim',exact:true})).toBeDisabled();
});

test('a transport failure persists UUID and another actor cannot reuse its pending state',async({page})=>{
 await mount(page);
 await page.evaluate(()=>{(window as any).fixture.transportError=true});
 await page.getByLabel('Nama',{exact:true}).fill('Private guest');await page.getByLabel('Nominal',{exact:true}).fill('100');
 await page.getByRole('button',{name:'Kirim',exact:true}).click();
 await page.evaluate(()=>(window as any).fixture.finishCreate());
 await expect(page.getByRole('alert')).toContainText('Periksa koneksi');
 await page.goto('http://fixture.test/?otherActor=1');
 await expect(page.getByRole('button',{name:'Kirim',exact:true})).toBeEnabled();
 await expect(page.getByRole('status')).toHaveCount(0);
 expect(await page.evaluate(storageKey=>sessionStorage.getItem(storageKey),key)).toBe(req);
 await page.goto('http://fixture.test/');
 await expect(page.getByRole('status')).toContainText('Formulir baru dikunci');
});

test('unavailable session storage fails closed before any command dispatch',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw Error('storage disabled')}})});
 await mount(page);
 await page.getByLabel('Nama',{exact:true}).fill('Private guest');await page.getByLabel('Nominal',{exact:true}).fill('100');
 await page.getByRole('button',{name:'Kirim',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Transaksi belum dikirim');
 expect(await page.evaluate(()=>(window as any).fixture.creates)).toEqual([]);
});


