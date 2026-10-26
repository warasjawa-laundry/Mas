import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync('app/admin/points/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function action(result){
 const out={exports:{}};let writes=0;
 const mocks={'next/navigation':{redirect(url){throw Error('redirect:'+url)}},'@/lib/supabase/owner':{requireOwner:async()=>({supabase:{rpc:async()=>{writes++;return result}}})}};
 runInNewContext(compiled,{require:n=>mocks[n],exports:out.exports,module:out,Number,String,Array});
 return {save:out.exports.recordAmountVisit,writes:()=>writes};
}
function input(description='Cuci setrika 15 kg'){
 const f=new FormData();for(const [k,v] of Object.entries({memberId:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002',amountIdr:'75000',description}))f.set(k,v);return f;
}
test('server validation returns inline error without writing or dropping submitted input',async()=>{
 const a=action({});const result=await a.save(input('Cuci\nsetrika'));
 assert.match(result.error,/satu baris/);assert.equal(a.writes(),0);
});
test('database save failure is returned to the existing form rather than redirecting away',async()=>{
 const a=action({data:null,error:{message:'connection failed'}});
 assert.match((await a.save(input())).error,/belum berhasil disimpan/);assert.equal(a.writes(),1);
});
test('successful save still redirects with awarded points',async()=>{
 const a=action({data:[{points_awarded:5}],error:null});
 await assert.rejects(a.save(input()),/amountRecorded=1&pointsEarned=5/);
});
