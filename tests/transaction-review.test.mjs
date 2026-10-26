import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync('components/admin/amount-visit-form.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function fixture(active=true,save=async()=>({error:'Penyimpanan gagal. Coba lagi.'})){
 const states=[];let cursor=0;const action=save;
 const jsx=(type,props)=>({type,props});const output={exports:{}};
 const mocks={'react':{useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=v]}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-dom':{useFormStatus:()=>({pending:false})},'@/app/admin/points/actions':{recordAmountVisit:action}};
 runInNewContext(compiled,{exports:output.exports,module:output,require:n=>mocks[n],Intl,Number});
 const render=()=>{cursor=0;return output.exports.default({memberName:'Nama Contoh',memberId:'synthetic',requestId:'stable-idempotency-key',memberActive:active,tiers:[{minimum:0,points:0},{minimum:20000,points:1},{minimum:50000,points:3},{minimum:75000,points:5},{minimum:200000,points:20}],year:2026})};
 return {render,action};
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]}
function byId(tree,id){return nodes(tree).find(n=>n.props?.id===id)}
test('review keeps the captured member, nominal, points and request key before final submit',()=>{
 const f=fixture();let tree=f.render();
 assert.equal(typeof tree.props.action,'function');
 assert.equal(nodes(tree).find(n=>n.type==='button').props.disabled,true);
 byId(tree,'amount-visit-idr').props.onChange({target:{value:'75000'}});
 byId(tree,'amount-visit-note').props.onChange({target:{value:'Cuci setrika 15 kg'}});
 tree=f.render();assert.equal(nodes(tree).find(n=>n.type==='button').props.disabled,false);
 let prevented=false;tree.props.onSubmit({preventDefault(){prevented=true}});assert.equal(prevented,true);
 tree=f.render();const review=nodes(tree).find(n=>n.props?.className==='transaction-review');
 assert.match(JSON.stringify(review),/Nama Contoh/);assert.match(JSON.stringify(review),/75.000/);
 assert.match(JSON.stringify(tree),/5 poin/);
 assert.equal(byId(tree,'amount-visit-idr').props.value,'75000');
 assert.equal(nodes(tree).find(n=>n.props?.name==='requestId').props.value,'stable-idempotency-key');
 prevented=false;tree.props.onSubmit({preventDefault(){prevented=true}});assert.equal(prevented,false);
 const actions=nodes(tree).find(n=>typeof n.type==='function');
 actions.props.onEdit();tree=f.render();assert.equal(byId(tree,'amount-visit-idr').props.value,'75000');
 assert.equal(nodes(tree).find(n=>n.props?.className==='transaction-review'),undefined);
});
test('inactive member cannot begin the save flow',()=>{
 const tree=fixture(false).render();assert.equal(byId(tree,'amount-visit-idr').props.disabled,true);
 assert.equal(nodes(tree).find(n=>n.type==='button').props.disabled,true);
});

test('multiline descriptions are rejected before review with an accessible explanation',()=>{
 const f=fixture();let tree=f.render();
 byId(tree,'amount-visit-idr').props.onChange({target:{value:'75000'}});
 byId(tree,'amount-visit-note').props.onChange({target:{value:'Cuci setrika\n15 kg'}});
 tree=f.render();
 assert.equal(nodes(tree).find(n=>n.type==='button').props.disabled,true);
 assert.match(JSON.stringify(nodes(tree).find(n=>n.props?.role==='alert')),/satu baris/);
});

test('failed save keeps captured input and request key for a safe retry',async()=>{
 let saves=0;
 const f=fixture(true,async()=>{saves++;return {error:'Transaksi belum berhasil disimpan. Coba lagi.'}});
 let tree=f.render();
 byId(tree,'amount-visit-idr').props.onChange({target:{value:'75000'}});
 byId(tree,'amount-visit-note').props.onChange({target:{value:'Cuci setrika 15 kg'}});
 tree=f.render();tree.props.onSubmit({preventDefault(){}});tree=f.render();
 await tree.props.action(new FormData());tree=f.render();
 assert.equal(saves,1);
 assert.match(JSON.stringify(nodes(tree).find(n=>n.props?.role==='alert')),/belum berhasil disimpan/);
 assert.equal(byId(tree,'amount-visit-idr').props.value,'75000');
 assert.equal(byId(tree,'amount-visit-note').props.value,'Cuci setrika 15 kg');
 assert.equal(nodes(tree).find(n=>n.props?.name==='requestId').props.value,'stable-idempotency-key');
});
