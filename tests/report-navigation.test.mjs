import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextRequest} from 'next/server.js';
const require=createRequire(import.meta.url);
const RouterForm=()=>null;
function load(file,mocks,extra={}){
 const module={exports:{}};
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:n=>mocks[n]??require(n),Date,URL,...extra});
 return module.exports;
}
function find(node,predicate){
 if(!node||typeof node!=='object')return null;
 if(predicate(node))return node;
 for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}
 return null;
}
for(const role of ['admin','kasir'])test(`${role} date filtering uses router navigation with both selected dates`,async()=>{
 const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:null,error:null};}};
 const jsx=(type,props)=>({type,props});
 const page=load(`app/${role}/laporan/page.tsx`,{
  'react/jsx-runtime':{jsx,jsxs:jsx},'next/form':{default:RouterForm},'next/link':()=>null,
  'next/navigation':{redirect:path=>{throw Error(path);}},
  '@/components/pos/context-notice':{default:()=>null,readDisplayContext:()=>null},
  '@/components/pos/pos-workspace':()=>null,
  '@/lib/pos/ui-labels':{},'@/lib/pos/cashier-permissions':{hasCashierGrant:()=>true},
  '@/lib/supabase/owner':{requireOwner:async()=>({supabase:client})},
  '@/lib/pos/g4-server':{cashierRpcAccess:async grant=>{assert.equal(grant,'reports_view');return {client,tokens:{p_login_token:'synthetic'},session:{permissions:{}}};}},
  '@/lib/pos/g4-order':{},'@/lib/pos/g6-cash':{isReport:()=>false,reportingPeriod:(start,end)=>({p_start:start,p_end:end})},
  '@/app/kasir/pesanan/orders.module.css':{default:{}},'../pesanan/orders.module.css':{default:{}}
 }).default;
 const tree=await page({searchParams:Promise.resolve({start:'2026-11-01',end:'2026-11-05'})});
 const form=find(tree,n=>n.type===RouterForm);
 assert.ok(form,'native GET form reloads the Owner document and revokes the session');
 assert.equal(form.props.action,`/${role}/laporan`);
 assert.equal(form.props.prefetch,false);
 for(const [name,value] of [['start','2026-11-01'],['end','2026-11-05']])assert.equal(find(form,n=>n.type==='input'&&n.props.name===name).props.defaultValue,value);
 assert.equal(calls[1].args.p_start,'2026-11-01');assert.equal(calls[1].args.p_end,'2026-11-05');
});

test('report router navigation preserves session; native reload still requires reauthentication',async()=>{
 let revoked=0,claims=0;
 const proxy=load('proxy.ts',{
  'next/server':require('next/server.js'),
  '@supabase/ssr':{createServerClient:()=>({auth:{getClaims:async()=>{claims++;},signOut:async()=>{revoked++;}}})},
  '@/lib/supabase/qa-preview-isolation':{assertQaPreviewIsolation:()=>{}},
  '@/lib/admin/entry-pass':{ADMIN_ACCESS_COOKIE:'mj-admin-access',ADMIN_ENTRY_COOKIE:'mj-admin-entry',adminSessionCookieOptions:{path:'/admin'},validAdminEntry:()=>false}
 },{process:{env:{SUPABASE_URL:'https://synthetic.invalid',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}}).proxy;
 const url='https://example.invalid/admin/laporan?start=2026-11-01&end=2026-11-05';
 const cookie='mj-admin-access=synthetic; sb-qa-auth-token=synthetic';
 const soft=await proxy(new NextRequest(url,{headers:{cookie,rsc:'1','next-url':'/admin/laporan','sec-fetch-dest':'empty'}}));
 assert.equal(soft.status,200);assert.equal(revoked,0);assert.equal(claims,1);assert.equal(soft.cookies.getAll().length,0);
 const reload=await proxy(new NextRequest(url,{headers:{cookie,'sec-fetch-dest':'document','sec-fetch-mode':'navigate'}}));
 assert.equal(reload.status,303);assert.equal(new URL(reload.headers.get('location')).pathname,'/admin/login');assert.equal(revoked,1);
 assert.ok(reload.cookies.getAll().some(c=>c.name==='mj-admin-access'&&c.value===''));
});
