import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as cash from '../lib/pos/g6-cash.ts';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function form(category='PACKAGING',direction='OUT',note=''){const f=new FormData();for(const [k,v] of Object.entries({requestId:id,amountIdr:'5000',direction,categoryCode:category,note}))f.set(k,v);return f;}
test('structured cash requires an approved category and keeps notes optional',()=>{
 assert.equal(typeof cash.parseStructuredCashEntry,'function');
 assert.deepEqual(cash.parseStructuredCashEntry(form()),{requestId:id,amountIdr:'5000',direction:'OUT',categoryCode:'PACKAGING',note:''});
 assert.equal(cash.CASH_CATEGORIES.filter(c=>c.classification==='EXPENSE').length,8);
 for(const f of [form('OTHER','IN'),form('UNKNOWN'),form('PACKAGING','OUT','x'.repeat(301)),form('PACKAGING','OUT','bad\nline')])assert.equal(cash.parseStructuredCashEntry(f),null);
 for(const c of ['CAPITAL','CASH_TRANSFER'])for(const d of ['IN','OUT'])assert.equal(cash.parseStructuredCashEntry(form(c,d))?.categoryCode,c);
});
