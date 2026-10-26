import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
test('card recovery retries server data instead of only resetting the error state',()=>{
 const out={exports:{}};const jsx=(type,props)=>({type,props});
 const source=ts.transpileModule(readFileSync('app/k/[token]/error.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInNewContext(source,{exports:out.exports,module:out,require:n=>n==='react/jsx-runtime'?{jsx,jsxs:jsx}: {}});
 let retried=0,reset=0;const tree=out.exports.default({retry:()=>retried++,reset:()=>reset++});
 function nodes(t){if(!t||typeof t!=='object')return [];return [t,...[t.props?.children].flat(Infinity).flatMap(nodes)]}
 nodes(tree).find(n=>n.type==='button').props.onClick();
 assert.equal(retried,1);assert.equal(reset,0);
});
