import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextRequest} from 'next/server.js';
import {issueAdminAccess,validAdminAccess,ADMIN_ACCESS_COOKIE} from '../lib/admin/entry-pass.ts';

const realRequire=createRequire(import.meta.url);
function load(path,mocks,extra={}){
 const exports={};
 runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
  {require:n=>mocks[n]??realRequire(n),exports,URL,process:{env:{SUPABASE_URL:'https://synthetic.invalid',SUPABASE_PUBLISHABLE_KEY:'synthetic-only'}},...extra});
 return exports;
}
test('login Next prefetch bypasses the logout proxy at route matching, while admin pages stay matched',()=>{
 const {getMiddlewareMatchers}=realRequire('next/dist/build/analysis/get-page-static-info');
 const {getMiddlewareRouteMatcher}=realRequire('next/dist/shared/lib/router/utils/middleware-route-matcher');
 const {config}=load('proxy.ts',{'next/server':realRequire('next/server'),'@supabase/ssr':{},
  '@/lib/supabase/qa-preview-isolation':{},'@/lib/admin/entry-pass':{}});
 const matches=getMiddlewareRouteMatcher(getMiddlewareMatchers(config.matcher,{}));
 const prefetch={headers:{'next-router-prefetch':'1',rsc:'1'}};
 assert.equal(matches('/admin/login',prefetch,{}),false);
 assert.equal(matches('/admin/login',{headers:{rsc:'1'}},{}),true);
 for(const path of ['/admin','/admin/pos/kasir','/admin/members','/admin/leave'])
  assert.equal(matches(path,prefetch,{}),true,path);
});
test('login prefetch does not revoke owner before the cashier save POST',async()=>{
 const previous=process.env.LAUNDRY_CARD_ENCRYPTION_KEY;
 process.env.LAUNDRY_CARD_ENCRYPTION_KEY='synthetic-only-prefetch-test-key-at-least-32';
 try{
  const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',is_anonymous:false};
  let revoked=false,posts=0;
  const jar=new Map([[ADMIN_ACCESS_COOKIE,issueAdminAccess(user.id)]]);
  const cookieStore={get:n=>jar.has(n)?{value:jar.get(n)}:undefined,set:(n,v)=>jar.set(n,v)};
  const client={auth:{getUser:async()=>({data:{user:revoked?null:user},error:null}),getClaims:async()=>({}),signOut:async()=>{revoked=true;return {error:null}}},
   from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{is_active:true},error:null})})})}),
   rpc:async()=>{posts++;return {data:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',error:null}}};
  const proxy=load('proxy.ts',{
   'next/server':realRequire('next/server'),
   '@supabase/ssr':{createServerClient:()=>client},
   '@/lib/supabase/qa-preview-isolation':{assertQaPreviewIsolation:()=>{}},
   '@/lib/admin/entry-pass':{ADMIN_ACCESS_COOKIE,ADMIN_ENTRY_COOKIE:'mj-admin-entry',adminSessionCookieOptions:{path:'/admin'},validAdminEntry:()=>false},
  }).proxy;
  const owner=load('lib/supabase/owner.ts',{
   'server-only':{},'next/headers':{cookies:async()=>cookieStore},
   'next/navigation':{redirect:url=>{throw Error(url)}},
   '@/lib/admin/entry-pass':{ADMIN_ACCESS_COOKIE,validAdminAccess},
   '@/lib/supabase/server':{createOwnerClient:async()=>client},
   '@/lib/admin/timing':{timeAdmin:(_name,fn)=>fn()},
  });
  assert.ok(await owner.getVerifiedOwner());
  for(const headers of [{'next-router-prefetch':'1',rsc:'1','next-url':'/admin/pos/kasir'},{purpose:'prefetch',rsc:'1','next-url':'/'},{'sec-purpose':'prefetch;prerender',rsc:'1'}]){
   const response=await proxy(new NextRequest('https://example.invalid/admin/login?role=kasir',{headers:{...headers,cookie:`${ADMIN_ACCESS_COOKIE}=${jar.get(ADMIN_ACCESS_COOKIE)}; sb-qa-auth-token=synthetic`}}));
   for(const c of response.cookies.getAll()){if(c.maxAge===0||c.value==='')jar.delete(c.name);else jar.set(c.name,c.value);}
   assert.equal(revoked,false,'speculative login GET revoked owner session');
   assert.equal(response.cookies.getAll().length,0,'prefetch must not clear or issue session cookies');
  }
  const action=load('app/admin/pos/kasir/actions.ts',{
   'next/headers':{cookies:async()=>cookieStore},'next/navigation':{redirect:url=>{throw Error(url)}},'next/cache':{revalidatePath:()=>{}},
   '@/lib/supabase/owner':owner,'@/lib/pos/cashier-permissions':{parseCashierGrants:()=>({})},
   '@/lib/pos/cashier-device-token':{},'@/lib/pos/cashier-device':{},
   '@/lib/admin/entry-pass':{ADMIN_ENTRY_COOKIE:'mj-admin-entry',adminSessionCookieOptions:{path:'/admin'},issueAdminEntry:()=> 'synthetic-entry'},
  }).saveCashier;
  const form=new FormData();form.set('name','Synthetic cashier');
  await assert.rejects(action(form),/saved=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/);
  assert.equal(posts,1);
  assert.ok(await owner.getVerifiedOwner());
  // An intentional RSC navigation to login still removes the owner session.
  await proxy(new NextRequest('https://example.invalid/admin/login',{headers:{rsc:'1',cookie:'sb-qa-auth-token=synthetic'}}));
  assert.equal(revoked,true);
  assert.equal(await owner.getVerifiedOwner(),null);
  await assert.rejects(action(form),/^Error: \/admin\/login$/);
  assert.equal(posts,1,'logged-out owner must not write');
 }finally{if(previous===undefined)delete process.env.LAUNDRY_CARD_ENCRYPTION_KEY;else process.env.LAUNDRY_CARD_ENCRYPTION_KEY=previous;}
});
