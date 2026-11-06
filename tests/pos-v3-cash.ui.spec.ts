import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {CASH_CATEGORIES} from '../lib/pos/g6-cash';
const req=createRequire(process.cwd()+'/package.json');
const out={exports:{} as any};
const mocks:Record<string,unknown>={
 'next/link':{default:(p:any)=>createElement('a',p)},
 '@/components/admin/recoverable-form':{default:({children,className}:any)=>createElement('form',{className},children)},
 '@/components/admin/pending-submit':{default:({label,...p}:any)=>createElement('button',p,label)},
 './disclosure':{default:({title,children}:any)=>createElement('details',{},createElement('summary',{},title),children)},
 '@/lib/pos/g4-order':{formatIdr:(v:string)=>'Rp'+BigInt(v).toLocaleString('id-ID')},
 '@/lib/pos/g6-cash':{CASH_CATEGORIES},
 '@/app/kasir/pesanan/orders.module.css':{default:new Proxy({},{get:(_,key)=>String(key)})}
};
const fields={exports:{} as any};
runInNewContext(ts.transpileModule(readFileSync('components/pos/cash-entry-fields.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:fields.exports,module:fields,require:(n:string)=>mocks[n]??req(n)});
mocks['./cash-entry-fields']=fields.exports;
runInNewContext(ts.transpileModule(readFileSync('components/pos/cash-panel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out.exports,module:out,require:(n:string)=>mocks[n]??req(n),Date});
const overview={open:false,opening_idr:'0',cash_in_idr:'25000',cash_out_idr:'0',expected_cash_idr:'25000',entries:[{id:'ledger-1',direction:'IN',category:'PAYMENT',method:'QRIS',amount_idr:'25000',invoice_no:'NOTA-1001',occurred_at:'2026-11-04T19:00:00Z',order_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',actor:'MAS-2001',customer:'Penguji V3',can_view_order:true,item_count:3,quantity_summary:'1,25 kg · 2,375 m · 3 pcs'}],reconciliations:[{at:'2026-11-04T19:00:00Z',owner:'Owner MasJawa',expected:'25000',counted:'24000',difference:'-1000',reason:'QA periksa selisih'}]};
for(const width of [320,390,768,1440])test(`V3 cash references and owner reconciliation are readable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const html=renderToStaticMarkup(createElement(out.exports.default,{overview,role:'owner',mayEdit:true,canFinance:true,requestId:'fixture',recoveryKey:'fixture',action:async()=>({error:''}),recoverAction:async()=>({error:''})}));
 await page.setContent(`<style>body{margin:0;padding:16px}*{box-sizing:border-box}a,summary,input,button,select{min-height:44px}small{display:block}div{overflow-wrap:anywhere}</style>${html}`);
 await expect(page.getByText(/Petugas: MAS-2001/)).toBeVisible();
 await expect(page.getByText(/Selisih Rp-1.000/)).toBeVisible();
 await expect(page.getByText(/Buka shift|Tutup shift|Buka kas utama/)).toHaveCount(0);
 await page.getByText('Catat kas masuk / keluar non-penjualan',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Simpan mutasi',exact:true})).toBeVisible();
 await expect(page.getByLabel('Kategori',{exact:true})).toHaveValue('PACKAGING');
 await page.getByLabel('Kategori',{exact:true}).selectOption('CAPITAL');
 await page.getByLabel(/^Jenis/).selectOption('IN');
 await page.getByLabel('Catatan (opsional)',{exact:true}).fill('Modal operasional');
 await expect(page.getByLabel('Catatan (opsional)',{exact:true})).not.toHaveAttribute('required');
 await expect(page.locator('#mutasi-ledger-1')).toContainText('3 layanan · 1,25 kg · 2,375 m · 3 pcs');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await expect(page.getByRole('link',{name:'Lihat Rincian Layanan',exact:true})).toHaveAttribute('href','/admin/pesanan/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
});
