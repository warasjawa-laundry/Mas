import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readPointSimulation,pointSimulationLines} from '../lib/pos/point-simulation.ts';
import * as metadata from '../lib/pos/point-simulation.ts';
const sample={booked:false,total_idr:'75000',paid_idr:'25000',refunded_idr:'0',state:'PARTIAL',points:5,rule_available:true,program_year:2026,rule_revision:1,persisted_order:true};
test('simulation metadata never invents a zero for missing or malformed rules',()=>{
 assert.deepEqual(readPointSimulation(sample),sample);
 for(const change of [{booked:true},{points:1.5},{points:-1},{points:'5'},{rule_available:false},{total_idr:'75000.0'},{total_idr:75000},{state:'AWARDED'},{program_year:2025}])
  assert.equal(readPointSimulation({...sample,...change}),null,JSON.stringify(change));
 const unavailable={...sample,rule_available:false,points:null,rule_revision:null};
 assert.equal(readPointSimulation(unavailable)?.points,null);
 assert.match(pointSimulationLines(unavailable).join('\n'),/belum tersedia/);
 assert.doesNotMatch(pointSimulationLines(unavailable).join('\n'),/\+0 poin/);
});
test('all displayed states remain estimates or cancellation, never posted member balances',()=>{
 for(const state of ['ESTIMATE','UNPAID','PARTIAL','PAID','REFUNDED','CANCELLED','ZERO_TOTAL']){
  const text=pointSimulationLines({...sample,state}).join('\n');
  assert.match(text,/TIDAK DIBUKUKAN/);assert.doesNotMatch(text,/Total Poin Aktif|Poin diterima/);
  if(['REFUNDED','CANCELLED'].includes(state)){assert.match(text,/dibatalkan/);assert.doesNotMatch(text,/\+5 poin/);}
 }
});
test('concurrent payment changes cannot display simulation from a different financial snapshot',()=>{
 const matches=metadata.pointSimulationMatchesPayment;
 assert.equal(typeof matches,'function');
 const financial={total_idr:'75000',paid_idr:'25000',refunded_idr:'0',payment_status:'PARTIAL'};
 assert.equal(matches(sample,financial),true);
 for(const change of [{paid_idr:'75000',payment_status:'PAID'},{refunded_idr:'25000',payment_status:'REFUNDED'},{total_idr:'76000'}])assert.equal(matches(sample,{...financial,...change}),false);
 assert.equal(matches(null,financial),false);assert.equal(matches(sample,null),false);
});
