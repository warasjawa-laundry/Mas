import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const fixtureRequire=createRequire(import.meta.url);
const navigation=fixtureRequire('next/dist/client/components/unstable-rethrow.browser.js');
function fixture(action){
 const out={exports:{}};const states=[];let cursor=0;
 const jsx=(type,props)=>({type,props});
 const mocks={'react':{useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=v]}},'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':navigation};
 runInNewContext(ts.transpileModule(readFileSync('components/admin/recoverable-form.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:out.exports,module:out,require:n=>mocks[n]});
 return ()=>{cursor=0;return out.exports.default({action,children:'fields'})};
}
test('rejected transport returns inline retry feedback instead of escaping to an error boundary',async()=>{
 const render=fixture(async()=>{throw Error('network failed')});
 await render().props.action(new FormData());
 assert.match(JSON.stringify(render()),/koneksi/);
});
test('successful server redirects are rethrown for Next to perform navigation',async()=>{
 const redirect={digest:'NEXT_REDIRECT;push;/admin/members/synthetic/card;303;'};
 const render=fixture(async()=>{throw redirect});
 await assert.rejects(render().props.action(new FormData()),error=>error===redirect);
});
