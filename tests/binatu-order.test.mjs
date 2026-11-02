import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as money from '../lib/pos/money.ts';
import * as units from '../lib/pos/catalog-units.ts';
import * as order from '../lib/pos/g4-order.ts';
import * as catalog from '../lib/pos/g7-catalog.ts';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const helper=new URL('../lib/pos/ui-quantity.ts',import.meta.url);

test('quantity controls preserve fractional weights and respect strict catalog precision',async()=>{
 assert.ok(existsSync(helper),'precise UI quantity helper exists');
 const {stepQuantity}=await import(helper.href);
 assert.equal(stepQuantity('1.255','kg',1),'2.255');
 assert.equal(stepQuantity('2.255','kg',-1),'1.255');
 assert.equal(stepQuantity('0.255','kg',-1),'');
 assert.equal(stepQuantity('','pcs',1),'1');
 assert.equal(stepQuantity('1000000','kg',1),'1000000');
 assert.equal(stepQuantity('999999.999','m',1),'999999.999');
 for(const invalid of ['1.1','01','-1','1e3'])assert.equal(stepQuantity(invalid,'pcs',1),invalid);
 assert.equal(stepQuantity('1.1234','kg',1),'1.1234');
});

test('mobile flow reaches services without a quote, then requires a valid quote to confirm',async()=>{
 assert.ok(existsSync(helper),'flow helper exists');
 const {canAdvanceOrderStep}=await import(helper.href);
 assert.equal(canAdvanceOrderStep(0,true,true,false),true);
 assert.equal(canAdvanceOrderStep(0,false,true,false),false);
 assert.equal(canAdvanceOrderStep(1,true,true,false),true);
 assert.equal(canAdvanceOrderStep(1,true,false,false),false);
 assert.equal(canAdvanceOrderStep(2,true,true,false),false);
 assert.equal(canAdvanceOrderStep(2,true,true,true),true);
 assert.equal(canAdvanceOrderStep(3,true,true,true),false);
});

test('shared cashier/owner UI keeps payload/write safeguards and scanner without posting points',()=>{
 const form=source('app/kasir/pesanan/baru/order-form.tsx');
 assert.match(form,/CashierQrScanner/);
 assert.match(form,/<CashierQrScanner role=\{role\}/);
 assert.doesNotMatch(form,/recordOwnerVisit|laundry_record_visit/);
 assert.match(form,/step<3/);
 assert.match(form,/canAdvanceOrderStep/);
 assert.match(form,/stepQuantity/);
 for(const name of ['requestId','kind','guestName','memberNumber','items','perfume','notes'])assert.match(form,new RegExp('name="'+name+'"'));
 assert.match(form,/action=\{createCashierOrder\}/);
 assert.match(form,/disabled=\{!canWrite\|\|!quote\|\|!customerValid\}/);
 assert.match(form,/calculateOrderTotals/);
 assert.match(form,/useFormStatus/);
 assert.match(form,/disabled=\{disabled\|\|pending\}/);
 const detail=source('app/kasir/pesanan/[id]/page.tsx');
 for(const action of ['collectCashierPayment','openCashierShift','refundCashierOrder','advanceWorkStatus'])assert.match(detail,new RegExp('action=\\{'+action+'\\}'));
 assert.match(detail,/expectedVersion/);
 assert.match(detail,/wantsRetry\?query.retry/);
 assert.match(detail,/wantsRefundRetry\?query.retryRefund/);
});

test('real cashier markup escapes catalog text and keeps locked submission disabled',async()=>{
 const require=createRequire(import.meta.url);
 const quantities=await import(helper.href);
 const modules={
  'react':require('react'),'react-dom':require('react-dom'),'react/jsx-runtime':require('react/jsx-runtime'),
  '@/lib/pos/money':money,'@/lib/pos/catalog-units':units,'@/lib/pos/g4-order':order,
  '@/lib/pos/g7-catalog':catalog,'@/lib/pos/ui-quantity':quantities,
  '../actions':{createCashierOrder:async()=>{}},
  './member-search-actions':{findCashierMembers:async()=>[]},
  '@/app/admin/pesanan/member-actions':{findOwnerPosMembers:async()=>[]},
  './cashier-qr-scanner':{CashierQrScanner:()=>null},
  './wizard.module.css':{default:new Proxy({},{get:(_target,key)=>String(key)})},
 };
 function load(path){
  const compiled=ts.transpileModule(source(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const output={exports:{}};
  runInNewContext(compiled,{exports:output.exports,module:output,require:name=>{assert.ok(name in modules,name);return modules[name]},Intl,BigInt,Set,queueMicrotask});
  return output.exports;
 }
 modules['./member-name-picker']=load('app/kasir/pesanan/baru/member-name-picker.tsx');
 modules['./duration-sheet']=load('app/kasir/pesanan/baru/duration-sheet.tsx');
 const {OrderForm}=load('app/kasir/pesanan/baru/order-form.tsx');
 const props={services:[{id:'test',category:'Test catalog',package_name:'',name:'<script>unsafe</script>',price_idr:8000,unit:'kg',duration:'3 hari',revision:1}],requestId:'test-request',canWrite:false,canLookup:false};
 const html=renderToStaticMarkup(React.createElement(OrderForm,props));
 assert.match(html,/&lt;script&gt;unsafe&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>unsafe/);
 assert.match(html,/Transaksi POS masih dikunci/);
 assert.match(html,/<button[^>]*disabled=""[^>]*type="submit">Buat pesanan/);
 assert.match(html,/name="requestId" value="test-request"/);
 assert.doesNotMatch(html,/Scan|QR|poin|Promo/);
 const empty=renderToStaticMarkup(React.createElement(OrderForm,{...props,services:[]}));
 assert.match(empty,/Tidak ada layanan yang cocok/);
 assert.match(empty,/Belum ada layanan dipilih/);
});
