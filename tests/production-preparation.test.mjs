import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const legacy=readFileSync('index.html','utf8').match(/name="google-site-verification" content="([^"]+)"/)[1];
const compiled=ts.transpileModule(readFileSync('app/layout.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function metadata(env){
 const output={exports:{}};
 runInNewContext(compiled,{module:output,exports:output.exports,process:{env:{VERCEL_ENV:env}},URL,require:n=>n==='@/lib/site'?{site:{baseUrl:'https://masjawalaundry.web.id',name:'Mas Jawa Laundry'},assets:{logo:'synthetic',og:'synthetic'}}:{}});
 return output.exports.metadata;
}
test('Next metadata preserves the existing Google verification and canonical domain',()=>{
 const m=metadata('production');assert.equal(m.verification.google,legacy);assert.equal(m.metadataBase.origin,'https://masjawalaundry.web.id');assert.equal(m.alternates.canonical,'/');assert.equal(m.robots.index,true);
});
test('QA metadata stays out of the Google index while keeping verification intact',()=>{
 const m=metadata('preview');assert.equal(m.robots.index,false);assert.equal(m.verification.google,legacy);
});
