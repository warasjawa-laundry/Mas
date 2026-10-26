import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const out={exports:{}};
const source=ts.transpileModule(readFileSync('components/admin/promo-whatsapp.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
let states=[],cursor=0;
const jsx=(type,props)=>({type,props});
runInNewContext(source,{exports:out.exports,module:out,require:n=>({'react':{useRef:()=>({current:null}),useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>states[i]=v]}},'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':()=>null}[n]),Intl,Date});
const props={memberId:'synthetic',promoId:'synthetic',memberName:'N'.repeat(100),title:'P'.repeat(120),terms:'T'.repeat(2000),expiresAt:'2026-12-31T16:59:59Z',whatsappPhone:'+628123456789',whatsappConsent:true,memberActive:true};
function nodes(t){if(!t||typeof t!=='object')return [];return [t,...[t.props?.children].flat(Infinity).flatMap(nodes)];}
const render=()=>{cursor=0;return out.exports.default(props)};
test('maximum valid promotion draft fits editor and remains intact after a small edit',()=>{
 let tree=render();let input=nodes(tree).find(n=>n.type==='textarea');const original=input.props.value;
 assert.ok(original.length<=input.props.maxLength,'valid generated draft exceeds editor capacity');
 input.props.onChange({target:{value:'!'+original}});tree=render();input=nodes(tree).find(n=>n.type==='textarea');
 assert.equal(input.props.value,'!'+original);
 assert.match(input.props.value,/Berlaku sampai 31 Desember 2026/);
 const link=nodes(tree).find(n=>n.type==='a');
 assert.equal(new URL(link.props.href).searchParams.get('text'),('!'+original).trim());
});
