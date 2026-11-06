import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const req=createRequire(process.cwd()+'/package.json'),webpack=req('next/dist/compiled/webpack/webpack-lib');
const fixture=path.resolve('artifacts/fixtures/cash-review'),bundle=path.join(fixture,'bundle.js');
test.beforeAll(async()=>{
 mkdirSync(fixture,{recursive:true});
 for(const [name,file] of Object.entries({fields:'components/pos/cash-entry-fields.tsx',cash:'lib/pos/g6-cash.ts'}))writeFileSync(path.join(fixture,name+'.cjs'),ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 writeFileSync(path.join(fixture,'styles.cjs'),'exports.default={muted:"muted"};');
 writeFileSync(path.join(fixture,'entry.js'),`import React from 'react';import {createRoot} from 'react-dom/client';import Fields from './fields.cjs';createRoot(document.getElementById('root')).render(React.createElement(Fields,{role:window.cashRole}));`);
 await new Promise<void>((resolve,reject)=>{const compiler=webpack({mode:'production',optimization:{minimize:false},entry:path.join(fixture,'entry.js'),output:{path:fixture,filename:'bundle.js'},resolve:{modules:[path.resolve('node_modules'),'node_modules'],alias:{'@/lib/pos/g6-cash':path.join(fixture,'cash.cjs'),'@/app/kasir/pesanan/orders.module.css':path.join(fixture,'styles.cjs')}}});compiler.run((error:Error|null,stats:any)=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString())):resolve()));});
});
for(const width of [320,1440])for(const role of ['owner','cashier'])test(`${role} cash category controls and movement boundaries at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.setContent(`<style>body{margin:0;padding:16px}*{box-sizing:border-box}form{max-width:600px}label{display:grid;gap:4px;margin-top:12px}input,select{min-height:44px;max-width:100%;font:inherit}p{overflow-wrap:anywhere}</style><form id="root"></form>`);
 await page.evaluate(r=>{(window as any).cashRole=r;},role);await page.addScriptTag({path:bundle});
 const category=page.getByLabel('Kategori',{exact:true});await expect(category).toHaveValue('PACKAGING');
 if(role==='cashier'){
  await expect(category.locator('option')).toHaveCount(8);await expect(category.locator('option[value="CAPITAL"],option[value="CASH_TRANSFER"]')).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Jenis',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Jenis',exact:true}).locator('option[value="IN"]')).toHaveCount(0);
 }else{
  await category.selectOption('CASH_TRANSFER');await expect(page.getByLabel('Tujuan dana',{exact:true})).toHaveAttribute('required','');
  await expect(page.getByText(/Saldo rekening dan pasangan transfer tidak dikelola/)).toBeVisible();
  await page.getByLabel('Tujuan dana',{exact:true}).fill('Bank penguji');
  await page.getByRole('combobox',{name:'Jenis',exact:true}).selectOption('IN');await expect(page.getByLabel('Sumber dana',{exact:true})).toBeVisible();
  await category.selectOption('CAPITAL');await expect(page.locator('input[name="counterparty"]')).toHaveCount(0);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
