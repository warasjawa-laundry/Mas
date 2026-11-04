import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

test('member refresh invokes server refresh and exposes its pending state',()=>{
 const code=ts.transpileModule(readFileSync('components/member-progress-refresh.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 let calls=0,pending=false;
 const out={exports:{}};
 const mocks={react:{useTransition:()=>[pending,fn=>fn()]},'next/navigation':{useRouter:()=>({refresh:()=>calls++})},'react/jsx-runtime':{jsx:(type,props)=>({type,props})}};
 runInNewContext(code,{exports:out.exports,module:out,require:n=>mocks[n]});
 const button=out.exports.default();assert.equal(button.props.disabled,false);
 button.props.onClick();assert.equal(calls,1);
 pending=true;const busy=out.exports.default();
 assert.equal(busy.props.disabled,true);assert.equal(busy.props['aria-busy'],true);assert.equal(busy.props.children,'Memperbarui…');
});
