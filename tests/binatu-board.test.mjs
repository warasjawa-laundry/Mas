import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url);
function load(file){
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};
 runInNewContext(code,{module,exports:module.exports,Intl,Date,URLSearchParams,require:(id)=>{
  if(id==='next/link')return {default:({prefetch,...p})=>createElement('a',p)};
  if(id.startsWith('@/')){const p=id.slice(2);return load(p+(p.startsWith('lib/')?'.ts':'.tsx'))}
  return require(id);
 }});
 return module.exports;
}

const rows=[
 {id:'q',invoice_no:'MJL-1',customer_name:'Siti <img src=x>',total_idr:'75000',work_status:'QUEUED',payment_status:'UNPAID',created_at:'2026-11-01T10:00:00Z'},
 {id:'r',invoice_no:'MJL-2',customer_name:'Budi',total_idr:'30000',work_status:'READY',payment_status:'PARTIAL',created_at:'2026-11-01T10:00:00Z'},
 {id:'p',invoice_no:'MJL-3',customer_name:'Siti',total_idr:'50000',work_status:'COLLECTED',payment_status:'PAID',created_at:'2026-11-01T10:00:00Z'},
];
test('board filters unpaid includes DP and searches name or invoice without mutating source',()=>{
 const {filterBoardOrders}=load('lib/pos/board.ts');
 assert.deepEqual(Array.from(filterBoardOrders(rows,'unpaid','bUdI'),r=>r.id),['r']);
 assert.deepEqual(Array.from(filterBoardOrders(rows,'queue','MJL-1'),r=>r.id),['q']);
 assert.equal(filterBoardOrders(rows,'ready','absent').length,0);
 assert.equal(rows.length,3);
});
test('unavailable board does not pretend zero orders or financial balance is verified',()=>{
 const {default:Board}=load('components/pos/pos-board.tsx');
 const html=renderToStaticMarkup(createElement(Board,{role:'owner',dbReady:false}));
 assert.match(html,/Pesanan belum dapat dimuat/);
 assert.doesNotMatch(html,/G8 NO-GO|Scan QR|Scan Barcode|Pengaturan harga|href="\/admin\/scan/);
 assert.doesNotMatch(html,/Rp 0|Pesan Terkirim/);
});
test('board safely escapes customer text and exposes actual order routes',()=>{
 const {default:Board}=load('components/pos/pos-board.tsx');
 const html=renderToStaticMarkup(createElement(Board,{role:'cashier',orders:rows,dbReady:true,writeEnabled:true}));
 assert.match(html,/Siti &lt;img src=x&gt;/);
 assert.doesNotMatch(html,/<img src=x>/);
 assert.match(html,/\/kasir\/pesanan\/q/);
 assert.match(html,/\/kasir\/pesanan\/baru/);
 assert.match(html,/Cari pesanan/);
});
