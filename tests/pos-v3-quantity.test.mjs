import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stepQuantity} from '../lib/pos/ui-quantity.ts';
import {parseQuantityMilli,calculateOrderTotals} from '../lib/pos/money.ts';
test('V3 comma quantities and every scaled step retain the existing fraction',()=>{
 assert.equal(parseQuantityMilli('1,25','kg'),1250n);
 for(const [step,plus,minus] of [[1,'1.251','1.249'],[10,'1.26','1.24'],[100,'1.35','1.15'],[1000,'2.25','0.25']]){
  assert.equal(stepQuantity('1,25','kg',1,step),plus);assert.equal(stepQuantity('1.25','m',-1,step),minus);
 }
 assert.equal(stepQuantity('','kg',1,100),'0.1');assert.equal(stepQuantity('3','pcs',1,100),'4');
 assert.equal(stepQuantity('0.05','kg',-1,100),'');
 for(const bad of ['1,','-1','1.2345','1.2.3'])assert.equal(stepQuantity(bad,'kg',1,100),bad);
 assert.throws(()=>parseQuantityMilli('1,2','pcs'));
 assert.equal(calculateOrderTotals([{quantity:'1,25',unit:'kg',priceIdr:'6000'},{quantity:'2,35',unit:'m',priceIdr:'8000'},{quantity:'3',unit:'pcs',priceIdr:'15000'}]).totalIdr,'71300');
});
