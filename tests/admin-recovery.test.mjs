import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as validation from '../lib/laundry/validation.ts';
const member='00000000-0000-4000-8000-000000000001';
const request='00000000-0000-4000-8000-000000000002';
function load(file,{rpc={data:null,error:{message:'offline'}},ready=true}={}){
 const out={exports:{}};let writes=0;
 const mocks={'next/navigation':{redirect(url){throw Error('redirect:'+url)}},'@/lib/supabase/owner':{requireOwner:async()=>({supabase:{rpc:async()=>{writes++;return rpc}}})},'@/lib/laundry/card':{cardIssuanceReady:()=>ready,newCardToken:()=> 'synthetic-token',tokenDigest:()=> 'digest',encryptCardToken:()=> 'ciphertext'},'@/lib/laundry/validation':validation};
 const compiled=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 runInNewContext(compiled,{exports:out.exports,module:out,require:n=>mocks[n],Date,Number,String,Array});
 return {...out.exports,writes:()=>writes};
}
function form(values={}){const f=new FormData();for(const [k,v] of Object.entries({memberId:member,requestId:request,name:'Nama Contoh',title:'Diskon reguler',terms:'Sekali pakai',expires:'',...values}))f.set(k,v);return f;}
test('registration validation and database failure return inline errors without changing route',async()=>{
 const a=load('app/admin/members/actions.ts');
 assert.match((await a.registerLaundryMember(form({whatsapp:'123'}))).error,/WhatsApp/);
 assert.equal(a.writes(),0);
 assert.match((await a.registerLaundryMember(form())).error,/belum tersimpan/);
});
test('registration still requires a phone before granting promotional consent',async()=>{
 const a=load('app/admin/members/actions.ts');
 assert.match((await a.registerLaundryMember(form({consent:'on'}))).error,/nomor WhatsApp/);
 assert.equal(a.writes(),0);
});
test('registration success still opens the issued card',async()=>{
 const a=load('app/admin/members/actions.ts',{rpc:{data:member,error:null}});
 await assert.rejects(a.registerLaundryMember(form()),new RegExp('redirect:/admin/members/'+member+'/card'));
});
test('promo invalid date and database failure are returned to the form for retry',async()=>{
 const a=load('app/admin/promotions/actions.ts');
 assert.match((await a.grantManualPromo(form({expires:'2026-02-30'}))).error,/tanggal/);
 assert.equal(a.writes(),0);
 assert.match((await a.grantManualPromo(form())).error,/belum berhasil disimpan/);
});
test('contact save failure returns an error while preserving original revision in the form',async()=>{
 const a=load('app/admin/members/contact/actions.ts');
 assert.match((await a.updateMemberContact(form({expectedRevision:'1',consentAction:'KEEP'}))).error,/belum berhasil disimpan/);
});
test('promo lifecycle and contact success keep their original success routes',async()=>{
 const a=load('app/admin/promotions/actions.ts',{rpc:{data:request,error:null}});
 await assert.rejects(a.grantManualPromo(form()),/promo=created/);
 const b=load('app/admin/members/contact/actions.ts',{rpc:{data:'UPDATED',error:null}});
 await assert.rejects(b.updateMemberContact(form({expectedRevision:'1',consentAction:'KEEP'})),/result=saved/);
});

test('failed promo lifecycle and invalid cancellation reason return inline errors',async()=>{
 const a=load('app/admin/promotions/actions.ts');
 assert.match((await a.finishManualPromo(form({promoId:request,action:'CANCEL',reason:'x'}))).error,/Alasan/);
 assert.equal(a.writes(),0);
 assert.match((await a.finishManualPromo(form({promoId:request,action:'CANCEL',reason:'Salah promo'}))).error,/belum berhasil/);
});
