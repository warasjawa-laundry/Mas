import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const fixtureRequire=createRequire(process.cwd()+'/package.json');
const webpack=fixtureRequire('next/dist/compiled/webpack/webpack-lib');
const fixtureDir=path.resolve('test-results/recovery-fixture');
const bundle=path.join(fixtureDir,'bundle.js');
test.describe.configure({mode:'serial'});
test.beforeAll(async()=>{
 mkdirSync(fixtureDir,{recursive:true});
 for(const file of ['recoverable-form','pending-submit','service-editor']){
  writeFileSync(path.join(fixtureDir,file+'.cjs'),ts.transpileModule(readFileSync('components/admin/'+file+'.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 }
 writeFileSync(path.join(fixtureDir,'catalog.cjs'),ts.transpileModule(readFileSync('lib/services/catalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
 writeFileSync(path.join(fixtureDir,'service-action.cjs'),`exports.saveService=async()=>{await new Promise(r=>setTimeout(r,300));return {error:'Harga belum tersimpan. Coba lagi.'}};`);
 writeFileSync(path.join(fixtureDir,'entry.js'),`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import RecoverableForm from './recoverable-form.cjs';import PendingSubmit from './pending-submit.cjs';
 import ServiceEditor from './service-editor.cjs';
 createRoot(document.getElementById('service-root')).render(React.createElement(ServiceEditor,{service:{id:'synthetic',revision:3,name:'Cuci reguler',category:'Laundry',price_idr:10000,unit:'kg',is_visible:true},categories:['Laundry']}));
 createRoot(document.getElementById('root')).render(React.createElement(RecoverableForm,{action:async data=>{await new Promise(r=>setTimeout(r,300));if(data.get('name')==='Network failure')throw Error('offline');return {error:'Penyimpanan gagal. Coba lagi.'}},className:'admin-form'},
 React.createElement('label',{htmlFor:'name'},'Nama'),React.createElement('input',{id:'name',name:'name',required:true}),
 React.createElement('label',{htmlFor:'terms'},'Ketentuan'),React.createElement('textarea',{id:'terms',name:'terms'}),
 React.createElement('label',{htmlFor:'expiry'},'Tanggal berlaku'),React.createElement('input',{id:'expiry',name:'expiry',type:'date'}),
 React.createElement('label',null,React.createElement('input',{name:'consent',type:'checkbox'}),'Persetujuan'),
 React.createElement('input',{type:'hidden',name:'requestId',value:'stable-request'}),
 React.createElement(PendingSubmit,{label:'Simpan'})));
 `);
 await new Promise<void>((resolve,reject)=>{
  const compiler=webpack({mode:'production',optimization:{minimize:false},entry:path.join(fixtureDir,'entry.js'),output:{path:fixtureDir,filename:'bundle.js'},resolve:{modules:[path.resolve('node_modules'),'node_modules'],alias:{'next/navigation':fixtureRequire.resolve('next/dist/client/components/unstable-rethrow.browser.js'),'@/components/admin/pending-submit':path.join(fixtureDir,'pending-submit.cjs'),'@/lib/services/catalog':path.join(fixtureDir,'catalog.cjs'),'@/app/admin/settings/services/actions':path.join(fixtureDir,'service-action.cjs')}}});
  compiler.run((error:Error|null,stats:{hasErrors:()=>boolean;toString:()=>string})=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString())):resolve()));
 });
});
for(const width of [320,390,1440])test(`server failure retains form fields and blocks duplicate pending submit at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const css=readFileSync('app/globals.css','utf8')+'\n'+readFileSync('app/admin/admin.css','utf8');
 await page.setContent(`<style>${css}</style><div class="admin-root"><main class="admin-workspace"><div class="admin-content"><div id="root"></div><div id="service-root"></div></div></main></div>`);
 await page.addScriptTag({path:bundle});
 await page.getByLabel('Nama',{exact:true}).fill('Nama Contoh');
 await page.getByLabel('Ketentuan').fill('Ketentuan\nbaris kedua');
 await page.getByLabel('Tanggal berlaku').fill('2026-12-31');
 await page.getByLabel('Persetujuan').check();
 await page.getByRole('button',{name:'Simpan',exact:true}).click();
 await expect(page.getByRole('button',{name:'Menyimpan…',exact:true})).toBeDisabled();
 await expect(page.getByRole('alert')).toContainText('Penyimpanan gagal');
 await expect(page.getByLabel('Nama',{exact:true})).toHaveValue('Nama Contoh');
 await expect(page.getByLabel('Ketentuan')).toHaveValue('Ketentuan\nbaris kedua');
 await expect(page.getByLabel('Tanggal berlaku')).toHaveValue('2026-12-31');
 await expect(page.getByLabel('Persetujuan')).toBeChecked();
 await expect(page.locator('[name="requestId"]')).toHaveValue('stable-request');
 await expect(page.getByRole('button',{name:'Simpan',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 mkdirSync('artifacts/screenshots',{recursive:true});await page.screenshot({path:`artifacts/screenshots/form-recovery-${width}.png`,fullPage:true});
});

test('rejected action transport keeps inputs mounted and retry available',async({page})=>{
 await page.setContent('<div id="root"></div><div id="service-root"></div>');await page.addScriptTag({path:bundle});
 const form=page.locator('#root form');await form.getByLabel('Nama',{exact:true}).fill('Network failure');
 await form.getByRole('button',{name:'Simpan',exact:true}).click();
 await expect(form.getByRole('alert')).toContainText('Periksa koneksi');
 await expect(form.getByLabel('Nama',{exact:true})).toHaveValue('Network failure');
 await expect(form.locator('[name="requestId"]')).toHaveValue('stable-request');
 await expect(form.getByRole('button',{name:'Simpan',exact:true})).toBeEnabled();
});

test('failed price update retains the edited price and visibility after pending completes',async({page})=>{
 await page.setContent('<div id="root"></div><div id="service-root"></div>');await page.addScriptTag({path:bundle});
 const form=page.locator('#service-root form');
 await form.getByLabel('Harga (Rp) *',{exact:true}).fill('25000');
 await form.getByLabel('Tampilkan di homepage').uncheck();
 await form.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
 await expect(form.getByLabel('Harga (Rp) *',{exact:true})).toBeDisabled();
 await expect(form.getByRole('alert')).toContainText('Harga belum tersimpan');
 await expect(form.getByLabel('Harga (Rp) *',{exact:true})).toHaveValue('25000');
 await expect(form.getByLabel('Tampilkan di homepage')).not.toBeChecked();
});
