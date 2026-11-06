import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as receiptModel from '../lib/pos/receipt.ts';
import {receipt} from './pos-v3-receipt.fixture.mjs';
const require=createRequire(import.meta.url);
function load(file,mocks,extra={}){
 const module={exports:{}};
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:n=>mocks[n]??require(n),Date,...extra});return module.exports.default;
}

test('existing contact draft prefills WhatsApp verification without opening or sending a message',()=>{
 let reads=0;
 const jsx=(type,props)=>({type,props});
 const states=[];
 const module={exports:{}};
 const mocks={
  'react/jsx-runtime':{jsx,jsxs:jsx},
  'react':{useState:value=>{states.push(value);return [value,()=>{}];},useRef:()=>({current:0}),useEffect:()=>{}},
  '@/components/pos/disclosure':()=>null,'../receipt-actions':{prepareOrderReceipt:()=>{reads++;},verifyOrderContact:()=>{reads++;}},
  '@/lib/pos/receipt':receiptModel,'@/components/admin/recoverable-form':()=>null,'@/components/admin/pending-submit':()=>null,'../orders.module.css':{default:{}}
 };
 runInNewContext(ts.transpileModule(readFileSync('app/kasir/pesanan/[id]/whatsapp-draft.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:n=>mocks[n]??require(n)});
 const tree=module.exports.WhatsAppDraft({orderId:audit().order_id,role:'owner',workStatus:'QUEUED',version:1,initialContact:audit().contact_draft});
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const value=find(child,predicate);if(value)return value;}return null;}
 assert.equal(find(tree,n=>n.type==='input'&&n.props.name==='phone').props.value,'+628111111111');
 assert.equal(find(tree,n=>n.type==='input'&&n.props.name==='address').props.value,'Alamat penguji');
 assert.equal(find(tree,n=>n.type==='input'&&n.props.name==='confirmed').props.required,true);
 assert.equal(find(tree,n=>n.type==='a'),null);assert.equal(reads,0);
});
const audit=()=>({...structuredClone(receipt),is_test_order:false,order_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',order_version:'2',payment_version:'1',snapshot_at:'2026-11-06T09:00:00Z',service_subtotal:'71300',fees_idr:'0',discount_idr:'0',actor:'Owner MasJawa',contact_draft:{phone:'+628111111111',address:'Alamat penguji',verified_at:null},payments:[{amount_idr:'10000',received_at:'2026-11-06T08:00:00Z',receiver:'Kasir Kedua',method:'QRIS',internal_reference:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',cash_ledger_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}],refunds:[]});
const Component=load('components/pos/system-order-detail.tsx',{'next/link':{default:p=>createElement('a',p)},'@/lib/pos/receipt':receiptModel,'@/lib/pos/g4-order':{formatIdr:v=>'Rp'+BigInt(v).toLocaleString('id-ID')},'@/lib/pos/ui-labels':{paymentMethodLabel:m=>m},'@/app/kasir/pesanan/orders.module.css':{default:{}}});
test('internal audit separates creator from receiver and limits links to cash grant',()=>{
 for(const role of ['owner','cashier'])for(const grant of [true,false]){
  const html=renderToStaticMarkup(createElement(Component,{snapshot:audit(),role,canViewCash:grant,version:2}));
  for(const text of ['Owner MasJawa','Kasir Kedua','QRIS','Referensi internal','Rp10.000','Belum diverifikasi'])assert.ok(html.includes(text),text);
  assert.equal(html.includes('/kas?entry='),grant);
  assert.ok(!html.includes('<button'));
 }
});
test('mixed-version or malformed snapshots do not display unverified internal values',()=>{
 for(const snapshot of [null,{...audit(),order_version:'3'},{...audit(),paid:'99999'}]){
  const html=renderToStaticMarkup(createElement(Component,{snapshot,role:'owner',canViewCash:true,version:2}));
  assert.ok(html.includes('Rincian audit belum tersedia'));assert.ok(!html.includes('Kasir Kedua'));
 }
});

function downloader(response){
 const calls=[],errors=[];let links=0;const anchor={click:()=>{links++;},remove:()=>{}};
 const Component=load('components/pos/report-download.tsx',{'react':{useState:value=>[value,next=>{if(typeof next==='string'&&next)errors.push(next);}] }},{fetch:async(...args)=>{calls.push(args);return response;},URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:()=>{}},document:{createElement:()=>anchor,body:{appendChild:()=>{}}},setTimeout:()=>0,Error});
 const node=Component({href:'/admin/laporan/export?format=xlsx',filename:'laporan.xlsx',format:'xlsx',children:'Unduh Excel'});
 const button=node.props.children[0];
 return {run:button.props.onClick,calls,errors,anchor,links:()=>links};
}
test('report download uses same-origin fetch and a blob download without document navigation',async()=>{
 const d=downloader({ok:true,status:200,redirected:false,headers:{get:()=> 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},blob:async()=>({})});await d.run();
 assert.equal(d.calls[0][1].credentials,'same-origin');assert.equal(d.calls[0][1].cache,'no-store');assert.equal(d.links(),1);assert.equal(d.anchor.href,'blob:fixture');assert.equal(d.anchor.download,'laporan.xlsx');assert.equal(d.errors.length,0);
});
test('expired permission, oversized export and login HTML never become a downloaded report',async()=>{
 for(const response of [{ok:false,status:403},{ok:false,status:422},{ok:true,status:200,redirected:true}]){
  const d=downloader({...response,headers:{get:()=> 'text/html'}});await d.run();assert.equal(d.links(),0);assert.equal(d.errors.length,1);
 }
});
