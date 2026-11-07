import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const req=createRequire(process.cwd()+'/package.json'),webpack=req('next/dist/compiled/webpack/webpack-lib');
const fixture=path.resolve('artifacts/fixtures/report-period'),bundle=path.join(fixture,'bundle.js');
test.beforeAll(async()=>{
 mkdirSync(fixture,{recursive:true});
 for(const [name,file] of Object.entries({fields:'components/pos/report-period-fields.tsx',period:'lib/pos/report-v32.ts',download:'components/pos/report-download.tsx'}))writeFileSync(path.join(fixture,name+'.cjs'),ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
 writeFileSync(path.join(fixture,'styles.cjs'),'exports.default={muted:"muted"};');
 writeFileSync(path.join(fixture,'entry.js'),`import React from 'react';import {createRoot} from 'react-dom/client';import Fields from './fields.cjs';import Download from './download.cjs';createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement('form',{className:'paymentForm',onSubmit:e=>{e.preventDefault();window.submitted=Object.fromEntries(new FormData(e.currentTarget));}},React.createElement(Fields,{preset:'today',startDate:'2026-11-07',endDate:'2026-11-07',granularity:'day'}),React.createElement('button',{type:'submit',className:'mainButton'},'Tampilkan laporan')),React.createElement(Download,{href:'/export?format=xlsx&period=custom',filename:'report.xlsx',format:'xlsx',className:'mainLink'},'Unduh laporan Excel')));`);
 await new Promise<void>((resolve,reject)=>{const compiler=webpack({mode:'production',optimization:{minimize:false},entry:path.join(fixture,'entry.js'),output:{path:fixture,filename:'bundle.js'},resolve:{modules:[path.resolve('node_modules'),'node_modules'],alias:{'@/lib/pos/report-v32':path.join(fixture,'period.cjs'),'@/app/kasir/pesanan/orders.module.css':path.join(fixture,'styles.cjs')}}});compiler.run((error:Error|null,stats:any)=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString())):resolve()));});
});
for(const width of [320,390,1440])test(`report presets, inclusive custom dates, granularity and export at ${width}px`,async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-07T01:00:00Z'));
 await page.setViewportSize({width,height:1000});
 await page.setContent(`<style>body{margin:0;font-family:Arial}*{box-sizing:border-box}${readFileSync('app/kasir/pesanan/orders.module.css','utf8')}</style><main class="shell"><div id="root"></div></main>`);
 await page.addScriptTag({path:bundle});
 const period=page.getByRole('combobox',{name:'Jenis periode',exact:true});
 await expect(period.locator('option')).toHaveCount(7);
 for(const [preset,start,end] of [['today','2026-11-07','2026-11-07'],['yesterday','2026-11-06','2026-11-06'],['this_week','2026-11-02','2026-11-08'],['last_week','2026-10-26','2026-11-01'],['this_month','2026-11-01','2026-11-30'],['last_month','2026-10-01','2026-10-31']]){
  await period.selectOption(preset);await expect(page.getByLabel('Tanggal mulai',{exact:true})).toHaveValue(start);await expect(page.getByLabel('Tanggal akhir (termasuk)',{exact:true})).toHaveValue(end);await expect(page.getByRole('status')).toContainText(`${start} sampai ${end}`);
 }
 await period.selectOption('custom');await page.getByLabel('Tanggal mulai',{exact:true}).fill('2026-11-02');await page.getByLabel('Tanggal akhir (termasuk)',{exact:true}).fill('2026-11-02');
 for(const granularity of ['day','week','month']){await page.getByRole('combobox',{name:'Granularitas rekap',exact:true}).selectOption(granularity);await page.getByRole('button',{name:'Tampilkan laporan',exact:true}).click();expect(await page.evaluate(()=>(window as any).submitted)).toEqual({period:'custom',granularity,start:'2026-11-02',end:'2026-11-02'});}
 await page.evaluate(()=>{(window as any).fetchCalls=[];window.fetch=async(input,options)=>{(window as any).fetchCalls.push({input,options});return new Response('xlsx',{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});};});
 await page.getByRole('button',{name:'Unduh laporan Excel',exact:true}).click();
 await expect(page.getByRole('button',{name:'Unduh laporan Excel',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>(window as any).fetchCalls)).toEqual([{input:'/export?format=xlsx&period=custom',options:{credentials:'same-origin',cache:'no-store'}}]);
 await page.getByRole('combobox',{name:'Jenis periode',exact:true}).focus();await expect(page.getByRole('combobox',{name:'Jenis periode',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

