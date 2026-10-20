import {test} from "node:test";
import assert from "node:assert/strict";
import {planMigrationReconciliation,reconciliationSql} from "../scripts/reconcile-migration-history.mjs";
const local=[{name:"example",version:"20261017130000",sql:"select 1;\n"}];
const remote=[{name:"example",version:"20261017060000",statements:["select 1;"]}];
test("identical SQL can reconcile timestamp without replaying migration bodies",()=>{
 const plan=planMigrationReconciliation(local,remote);
 assert.equal(plan[0].new_version,local[0].version);
 const sql=reconciliationSql(plan);
 assert.match(sql,/LOCK TABLE supabase_migrations.schema_migrations/);
 assert.match(sql,/INTO STRICT actual/);
 assert.match(sql,/migration_history_changed/);
 assert.match(sql,/UPDATE supabase_migrations.schema_migrations SET version/);
 assert.doesNotMatch(sql,/select 1;/);
});
test("reconciliation rejects changed, unknown, duplicate or split remote SQL",()=>{
 for(const rows of [
  [{...remote[0],statements:["select 2;"]}],
  [{...remote[0],name:"unknown"}],
  [...remote,...remote],
  [{...remote[0],statements:["select 1;","select 2;"]}],
 ])assert.throws(()=>planMigrationReconciliation(local,rows));
});
test("already canonical history is idempotent and line endings are normalized",()=>{
 const plan=planMigrationReconciliation(local,[{...remote[0],version:local[0].version,statements:["select 1;\r\n"]}]);
 assert.equal(plan[0].old_version,plan[0].new_version);
 assert.match(reconciliationSql(plan),/IF actual.version <> item.new_version THEN/);
});
test("history version collisions fail before emitting SQL",()=>{
 const files=[...local,{name:"second",version:"20261017140000",sql:"select 2;"}];
 assert.throws(()=>planMigrationReconciliation(files,[...remote,{name:"second",version:local[0].version,statements:["select 2;"]}]),/collision/);
});
