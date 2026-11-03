import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseService} from '../lib/services/catalog.ts';
function form(minutes){
 const f=new FormData();
 for(const [k,v] of Object.entries({category:'Kiloan',package_name:'Reguler',name:'Cuci',unit:'kg',duration:'1–3 hari',price_idr:'6000',position:'1',is_visible:'yes'}))f.set(k,v);
 if(minutes!==undefined)f.set('duration_minutes',minutes);
 return f;
}
test('elapsed ETA minutes are optional and strict; blank explicitly clears override',()=>{
 assert.equal(parseService(form('360')).duration_minutes,360);
 assert.equal(parseService(form('')).duration_minutes,null);
 assert.equal('duration_minutes' in parseService(form()),false);
 for(const bad of ['0','-1','1.5','1e3','525601','99999999999'])assert.equal(parseService(form(bad)),null,bad);
});
