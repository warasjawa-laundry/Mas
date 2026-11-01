import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseG4OrderForm,formatIdr} from '../lib/pos/g4-order.ts';
import {calculateOrderTotals} from '../lib/pos/money.ts';
import {posUnitFromCatalog} from '../lib/pos/catalog-units.ts';

const service='33333333-3333-4333-8333-333333333333';
const req='44444444-4444-4444-8444-444444444444';
function form(fields={}){
 const f=new FormData();
 for(const [k,v] of Object.entries({requestId:req,kind:'guest',guestName:'Tamu QA',memberNumber:'',perfume:'',notes:'',items:JSON.stringify([{service_id:service,quantity:'1.255',revision:4}]),...fields}))f.set(k,v);
 return f;
}
test('G4 guest payload allows ID/qty/revision only and never trusts client price/actor',()=>{
 assert.deepEqual(parseG4OrderForm(form()),{requestId:req,guestName:'Tamu QA',memberNumber:null,items:[{service_id:service,quantity:'1.255',revision:4}],perfume:null,notes:null});
 assert.equal(parseG4OrderForm(form({items:JSON.stringify([{service_id:service,quantity:'2',revision:1,priceIdr:'1'}])})),null);
 assert.equal(parseG4OrderForm(form({items:JSON.stringify([{service_id:service,quantity:'2',revision:1,actor_id:'owner'}])})),null);
});
test('member lookup requires exact member number, no accidental guest fallback',()=>{
 assert.equal(parseG4OrderForm(form({kind:'member',guestName:'',memberNumber:'1234'}))?.memberNumber,'1234');
 for(const number of ['','0001','-1','1e3','1 2','1234567890123'])assert.equal(parseG4OrderForm(form({kind:'member',guestName:'',memberNumber:number})),null);
 assert.equal(parseG4OrderForm(form({kind:'member',guestName:'Lain',memberNumber:'1234'})),null);
});
test('request IDs and quantities must be exact bounded values',()=>{
 for(const id of ['','bad','a'.repeat(100)])assert.equal(parseG4OrderForm(form({requestId:id})),null);
 for(const qty of ['0','0.000','1.0000','-1','1e5','99999999','1,500','1 ','']){
  assert.equal(parseG4OrderForm(form({items:JSON.stringify([{service_id:service,quantity:qty,revision:1}])})),null,qty);
 }
 assert.equal(parseG4OrderForm(form({items:'[not-json'})),null);
 assert.equal(parseG4OrderForm(form({guestName:'X'})),null);
});
test('catalog units share exact integer IDR contract with backend',()=>{
 const p=calculateOrderTotals([
  {priceIdr:'6000',quantity:'1.255',unit:posUnitFromCatalog('kg')},
  {priceIdr:'15000',quantity:'2',unit:posUnitFromCatalog('M')},
 ]);
 assert.equal(p.totalIdr,'37530');assert.equal(formatIdr(p.totalIdr),'Rp37.530');
});