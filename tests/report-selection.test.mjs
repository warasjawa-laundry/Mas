import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(file,mocks={}){const module={exports:{}};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>mocks[n],Date,Intl});return module.exports;}
const selection=()=>load('lib/pos/report-selection.ts',{'./report-v32':load('lib/pos/report-v32.ts')}).readReportSelection;
test('inclusive UI dates include the selected final day at WIB midnight',()=>{const s=selection()({period:'custom',start:'2026-11-01',end:'2026-11-05',granularity:'week'});assert.equal(s.endDate,'2026-11-05');assert.equal(s.bounds.end,'2026-11-05T17:00:00.000Z');assert.equal(s.granularity,'week');});
test('legacy report links retain their exclusive end semantics',()=>{const s=selection()({start:'2026-11-01',end:'2026-11-05'});assert.equal(s.preset,'custom');assert.equal(s.endDate,'2026-11-04');assert.equal(s.bounds.end,'2026-11-04T17:00:00.000Z');});
test('default, preset, one day, invalid and 93 day boundaries',()=>{const read=selection();assert.equal(read({},'2026-11-07T01:00:00Z').startDate,'2026-11-07');assert.equal(read({period:'last_month'},'2026-11-07T01:00:00Z').endDate,'2026-10-31');assert.equal(read({period:'custom',start:'2026-01-01',end:'2026-04-03'}).bounds.days,93);for(const params of [{period:'custom',start:'2026-01-01',end:'2026-04-04'},{period:'custom',start:'2026-02-30',end:'2026-03-01'},{period:'custom',start:'2026-11-05',end:'2026-11-01'},{period:'nonsense'}])assert.equal(read(params).bounds,null);assert.equal(read({period:'custom',start:'2026-11-01',end:'2026-11-01'}).bounds.days,1);});
