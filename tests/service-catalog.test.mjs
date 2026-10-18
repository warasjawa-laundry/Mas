import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {parseService,groupServices,formatPrice} from '../lib/services/catalog.ts';
const valid={id:'00000000-0000-4000-8000-000000000012',revision:'3',category:'Cuci sepatu',package_name:'Reguler',name:'Sneakers',price_idr:'35000',unit:'pasang',duration:'2 hari',position:'20',is_visible:'yes'};
const form=(change={})=>{const f=new FormData();for(const [k,v] of Object.entries({...valid,...change}))f.set(k,v);return f};
test('service validation accepts arbitrary categories and units with integer Rupiah prices',()=>{
 assert.equal(parseService(form()).price_idr,35000);assert.equal(parseService(form({unit:'m²',category:'Karpet',price_idr:'0'})).price_idr,0);
 for(const price_idr of ['-1','35000.5','1e4','1000000001','', 'NaN'])assert.equal(parseService(form({price_idr})),null,price_idr);
 assert.equal(parseService(form({name:' '})),null);assert.equal(parseService(form({unit:'x'.repeat(25)})),null);assert.equal(parseService(form({position:'10000'})),null);
 assert.equal(parseService(form({name:'Bad\nname'})),null);assert.equal(parseService(form({is_visible:'no'})).is_visible,false);
 assert.equal(formatPrice(35000,'pasang'),'Rp35.000/pasang');
});
test('catalogue groups packages within categories while retaining configured order',()=>{
 const row=(id,category,package_name,position)=>({id,category,package_name,position,name:'Example',price_idr:12000,unit:'m²',duration:''});
 const groups=groupServices([row('c','Karpet','',30),row('b','Laundry','Reguler',20),row('a','Laundry','Reguler',10),row('d','Laundry','Express',40)]);
 assert.deepEqual(groups.map(g=>g.category),['Laundry','Karpet']);assert.equal(groups[0].groups.length,2);assert.deepEqual(groups[0].groups[0].items.map(s=>s.id),['a','b']);
});
function compiled(path){return ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText}
function actionFixture({error=null,unauthorized=false}={}){
 const calls=[];const out={exports:{}};
 const mocks={'next/navigation':{redirect(path){throw Object.assign(Error('redirect'),{path})}},'next/cache':{revalidatePath:p=>calls.push(['refresh',p])},'@/lib/supabase/owner':{requireOwner:async()=>{calls.push(['auth']);if(unauthorized)throw Error('denied');return {supabase:{rpc:async(name,args)=>{calls.push([name,args]);return {error}}}}}},'@/lib/services/catalog':{parseService}};
 runInNewContext(compiled('app/admin/settings/services/actions.ts'),{exports:out.exports,module:out,require:n=>mocks[n],Number,String});return {calls,save:f=>out.exports.saveService({error:''},f)};
}
test('owner action checks access, sends a versioned write, then invalidates homepage',async()=>{
 const f=actionFixture();await assert.rejects(f.save(form()),e=>e.path==='/admin/settings/services?saved=1');
 assert.equal(f.calls[0][0],'auth');assert.equal(f.calls[1][0],'laundry_save_service');assert.equal(f.calls[1][1].p_expected_revision,3);
 assert.equal(f.calls[1][1].p_input.unit,'pasang');assert.ok(f.calls.some(c=>c[0]==='refresh'&&c[1]==='/'));
 const denied=actionFixture({unauthorized:true});await assert.rejects(denied.save(form()),/denied/);assert.equal(denied.calls.length,1);
});
test('invalid or stale service edits return inline errors without redirecting or refreshing',async()=>{
 const f=actionFixture();assert.match((await f.save(form({price_idr:'-1'}))).error,/Periksa/);assert.equal(f.calls.length,1);
 const conflict=actionFixture({error:{message:'catalog_conflict'}});assert.match((await conflict.save(form())).error,/sudah berubah/);assert.equal(conflict.calls.length,2);
 const failure=actionFixture({error:{message:'network'}});assert.match((await failure.save(form())).error,/Isian tetap tersedia/);
});
test('Realtime browser configuration excludes service-role and secret credentials',()=>{
 const out={exports:{}};const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_secret_never_public'};
 runInNewContext(compiled('lib/services/server.ts'),{exports:out.exports,module:out,require:n=>({'server-only':{},'@supabase/supabase-js':{},'@/lib/supabase/qa-preview-isolation':{},'./defaults':{defaultServices:[]}}[n]),process:{env},Buffer,JSON});
 assert.equal(out.exports.catalogRealtimeConfig(),null);
 env.SUPABASE_PUBLISHABLE_KEY='a.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.b';assert.equal(out.exports.catalogRealtimeConfig(),null);
 env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic';assert.equal(out.exports.catalogRealtimeConfig().key,'sb_publishable_synthetic');
});
test('catalogue unmount tears down subscriptions and periodic work',async()=>{
 let effect,removed=0,cleared=0;const listeners=new Map();
 const socket={channel(){return {on(){return this},subscribe(){return this}}},removeAllChannels:async()=>{removed++},disconnect:async()=>{}};
 const out={exports:{}};
 const mocks={'react':{useEffect:f=>effect=f,useRef:()=>({current:''}),useState:v=>[v,()=>{}]},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'@/components/service-prices-view':()=>null,'@supabase/realtime-js':{RealtimeClient:class{constructor(){return socket}}}};
 const surface={addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
 runInNewContext(compiled('components/service-prices.tsx'),{exports:out.exports,module:out,require:n=>mocks[n],document:{...surface,hidden:false},window:surface,navigator:{onLine:true},AbortController,fetch:async()=>({status:200,ok:true,json:async()=>({services:[]}),headers:{get:()=>null}}),setInterval:()=>1,clearInterval:()=>cleared++});
 out.exports.default({initial:[],initialFailed:false,realtime:{url:'https://example.supabase.co',key:'sb_publishable_synthetic'}});
 const cleanup=effect();await new Promise(setImmediate);cleanup();await new Promise(setImmediate);
 assert.equal(removed,1);assert.equal(cleared,1);assert.equal(listeners.size,0);
});
