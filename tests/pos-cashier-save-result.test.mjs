import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function action(failed=false){
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',events=[];
 const supabase={rpc:async()=>({data:id,error:failed?{message:'connection failure'}:null})};
 const mocks={
  'next/headers':{cookies:async()=>({set:(...args)=>events.push(['cookie',...args])})},
  'next/navigation':{redirect:url=>{events.push(['redirect',url]);throw Error(url)}},
  'next/cache':{revalidatePath:()=>{}},
  '@/lib/supabase/owner':{requireOwner:async()=>({supabase,user:{id:'qa-owner'}})},
  '@/lib/pos/cashier-permissions':{parseCashierGrants:()=>({})},
  '@/lib/pos/cashier-device-token':{},'@/lib/pos/cashier-device':{},
  '@/lib/admin/entry-pass':{ADMIN_ENTRY_COOKIE:'mj-admin-entry',adminSessionCookieOptions:{path:'/admin',httpOnly:true},issueAdminEntry:user=>'signed:'+user},
 };
 const exports={};runInNewContext(ts.transpileModule(readFileSync('app/admin/pos/kasir/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{require:n=>mocks[n],exports});
 return {save:exports.saveCashier,id,events};
}
test('native cashier save redirect carries a one-use owner grant and created UUID',async()=>{
 const a=action(),form=new FormData();form.set('name','QA cashier');
 await assert.rejects(a.save(form));
 assert.equal(a.events[0]?.[0],'cookie');assert.equal(a.events[0]?.[1],'mj-admin-entry');
 assert.equal(a.events[0]?.[2],'signed:qa-owner');assert.equal(a.events[0]?.[3].maxAge,60);
 assert.equal(a.events.at(-1)?.[1],'/admin/pos/kasir?saved='+a.id);
});
test('failed cashier save can display error without losing the verified owner session',async()=>{
 const a=action(true),form=new FormData();form.set('name','QA cashier');await assert.rejects(a.save(form));
 assert.equal(a.events[0]?.[0],'cookie');assert.equal(a.events.at(-1)?.[1],'/admin/pos/kasir?error=failed');
});
