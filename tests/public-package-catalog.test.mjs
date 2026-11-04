import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import * as catalog from '../lib/services/catalog.ts';
test('public duration uses configured minutes as hours without mixing package prices',()=>{
 assert.equal(catalog.serviceHours({duration_minutes:4320,duration:'4320 menit'}),'72 jam');
 assert.equal(catalog.serviceHours({duration_minutes:1440,duration:'1440 menit'}),'24 jam');
 assert.equal(catalog.serviceHours({duration_minutes:360,duration:'360 menit'}),'6 jam');
 assert.equal(catalog.serviceHours({duration_minutes:90,duration:''}),'1,5 jam');
 assert.equal(catalog.serviceHours({duration_minutes:null,duration:''}),'Konfirmasi durasi');
});

test('catalogue API ETag changes with real prices and never masks a read failure as 304',async()=>{
 const source=ts.transpileModule(readFileSync('app/api/services/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const result={services:[{price_idr:7500}],failed:false};const out={exports:{}};
 const mocks={'node:crypto':{createHash},'next/server':{NextResponse:{json:(data,init={})=>new Response(JSON.stringify(data),init)}},'@/lib/services/server':{readPublishedServices:async()=>result}};
 runInNewContext(source,{exports:out.exports,module:out,require:n=>mocks[n],Response,JSON});
 const first=await out.exports.GET(new Request('https://fixture.invalid/api/services'));assert.equal(first.status,200);
 const headers={'if-none-match':first.headers.get('etag')};
 assert.equal((await out.exports.GET(new Request('https://fixture.invalid/api/services',{headers}))).status,304);
 result.services[0].price_idr=8000;
 const changed=await out.exports.GET(new Request('https://fixture.invalid/api/services',{headers}));assert.equal(changed.status,200);assert.notEqual(changed.headers.get('etag'),headers['if-none-match']);
 result.failed=true;assert.equal((await out.exports.GET(new Request('https://fixture.invalid/api/services',{headers}))).status,503);
});
test('public reader uses the scoped POS catalogue RPC and fails honestly without configuration',async()=>{
 const code=ts.transpileModule(readFileSync('lib/services/server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const out={exports:{}};const env={};const calls=[];
 const mocks={'server-only':{},'@/lib/supabase/qa-preview-isolation':{assertQaPreviewIsolation(){}},'./defaults':{defaultServices:[{price_idr:99}]},'@supabase/supabase-js':{createClient:()=>({rpc:async n=>{calls.push(n);return {data:[],error:null}}})}};
 runInNewContext(code,{exports:out.exports,module:out,require:n=>mocks[n],process:{env},Buffer,fetch,JSON});
 const empty=await out.exports.readPublishedServices();assert.equal(empty.failed,true);assert.equal(empty.services.length,0);
 env.SUPABASE_URL='https://fixture.invalid';env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture';
 assert.equal((await out.exports.readPublishedServices()).failed,false);assert.deepEqual(calls,['laundry_public_service_catalog']);
});
