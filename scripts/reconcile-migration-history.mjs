import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const normalize = text => text.replaceAll("\r\n", "\n").trim();
const hash = text => createHash("sha256").update(normalize(text)).digest("hex");

export function planMigrationReconciliation(local, remote) {
  const byName = new Map(local.map(row => [row.name, row]));
  const seen = new Set();
  if (byName.size !== local.length) throw new Error("Duplicate local migration name");
  const plan = remote.map(row => {
    const file = byName.get(row.name);
    if (!file || seen.has(row.name)) throw new Error("Unknown or duplicate remote migration: " + row.name);
    seen.add(row.name);
    if (!/^\d{14}$/.test(row.version) || !/^\d{14}$/.test(file.version)) throw new Error("Invalid migration version");
    if (!Array.isArray(row.statements) || row.statements.length !== 1 ||
        typeof row.statements[0] !== "string" || hash(row.statements[0]) !== hash(file.sql)) {
      throw new Error("Migration contents differ: " + row.name);
    }
    return { name: row.name, old_version: row.version, new_version: file.version, sha256: hash(file.sql) };
  });
  for (const row of plan) {
    if (plan.some(other => other !== row && other.old_version === row.new_version)) {
      throw new Error("Migration version collision: " + row.new_version);
    }
  }
  return plan;
}

export function reconciliationSql(plan) {
  // JSON contains only validated migration names/versions and SHA-256 hashes,
  // never SQL bodies, credentials, Auth identities or customer records.
  const payload = JSON.stringify(plan);
  if (payload.includes("$mapping$")) throw new Error("Invalid mapping delimiter");
  return `BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
DO $reconcile$
DECLARE
  item record;
  actual record;
BEGIN
  FOR item IN SELECT * FROM jsonb_to_recordset($mapping$${payload}$mapping$::jsonb)
    AS x(name text,old_version text,new_version text,sha256 text)
  LOOP
    SELECT * INTO STRICT actual FROM supabase_migrations.schema_migrations
      WHERE name=item.name;
    IF actual.version NOT IN (item.old_version,item.new_version)
      OR cardinality(actual.statements) IS DISTINCT FROM 1
      OR encode(sha256(convert_to(btrim(replace(actual.statements[1],E'\\r\\n',E'\\n'),E' \\t\\r\\n'),'UTF8')),'hex')
        IS DISTINCT FROM item.sha256
    THEN RAISE EXCEPTION 'migration_history_changed: %',item.name; END IF;
    IF actual.version <> item.new_version THEN
      IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=item.new_version)
      THEN RAISE EXCEPTION 'migration_version_collision: %',item.new_version; END IF;
      UPDATE supabase_migrations.schema_migrations SET version=item.new_version
        WHERE version=actual.version AND name=item.name;
    END IF;
  END LOOP;
END
$reconcile$;
COMMIT;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [input,mode="--check"] = process.argv.slice(2);
    if (!input || !["--check","--sql"].includes(mode)) throw new Error("Usage: node scripts/reconcile-migration-history.mjs HISTORY.json [--check|--sql]");
    const root = new URL("../supabase/migrations/",import.meta.url);
    const local = readdirSync(root).filter(name => name.endsWith(".sql")).map(file => {
      const match = /^(\d{14})_(.+)\.sql$/.exec(file);
      if (!match) throw new Error("Invalid local migration filename: " + file);
      return { version:match[1],name:match[2],sql:readFileSync(new URL(file,root),"utf8") };
    });
    const remote=JSON.parse(readFileSync(input,"utf8"));
    if (!Array.isArray(remote) || !remote.length) throw new Error("Expected a non-empty migration-history array");
    const plan=planMigrationReconciliation(local,remote);
    if (mode==="--sql") process.stdout.write(reconciliationSql(plan));
    else process.stdout.write(JSON.stringify({verified:plan.length,versionChanges:plan.filter(x=>x.old_version!==x.new_version),pending:local.filter(x=>!remote.some(r=>r.name===x.name)).map(x=>x.name)},null,2)+"\n");
  } catch (error) {
    process.stderr.write(error.message+"\n");
    process.exitCode=1;
  }
}
