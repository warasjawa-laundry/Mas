import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  QA_PREVIEW_REF,
  QA_SUPABASE_ORIGIN,
  QA_SUPABASE_PROJECT,
  OPERATIONAL_SUPABASE_ORIGIN,
  assertQaPreviewIsolation,
} from "../lib/supabase/qa-preview-isolation.ts";

const preview = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: QA_PREVIEW_REF,
};

test("explicit single-project mode uses only the operational database",()=>{
 const single={...preview,LAUNDRY_DATABASE_MODE:"single",SUPABASE_URL:OPERATIONAL_SUPABASE_ORIGIN,SUPABASE_PUBLISHABLE_KEY:"synthetic-public-key"};
 assert.doesNotThrow(()=>assertQaPreviewIsolation(single));
 for(const override of [{SUPABASE_URL:QA_SUPABASE_ORIGIN},{SUPABASE_PUBLISHABLE_KEY:undefined},{QA_BRANCH_ISOLATION:QA_SUPABASE_PROJECT}]){
  assert.throws(()=>assertQaPreviewIsolation({...single,...override}),/Single-project database/);
 }
});

test("QA Preview fails closed on missing branch override", () => {
  for(const extra of [
    {},
    { QA_BRANCH_ISOLATION: QA_SUPABASE_PROJECT },
    { QA_BRANCH_ISOLATION: QA_SUPABASE_PROJECT, SUPABASE_URL:"https://hncfyfvqtlnvqyfrydzb.supabase.co" },
    { QA_BRANCH_ISOLATION: QA_SUPABASE_PROJECT, SUPABASE_URL:QA_SUPABASE_ORIGIN },
    { QA_BRANCH_ISOLATION: "wrong", SUPABASE_URL:QA_SUPABASE_ORIGIN, SUPABASE_PUBLISHABLE_KEY:"qa-only" },
  ]) {
    assert.throws(
      () => assertQaPreviewIsolation({...preview,...extra}),
      /QA Preview database isolation is not configured/
    );
  }
});

test("QA Preview recognizes only its own Supabase project", () => {
  assert.doesNotThrow(() => assertQaPreviewIsolation({
    ...preview,
    QA_BRANCH_ISOLATION: QA_SUPABASE_PROJECT,
    SUPABASE_URL: QA_SUPABASE_ORIGIN,
    SUPABASE_PUBLISHABLE_KEY:"qa-only",
  }));
});

test("Main Preview and standalone builds retain their existing behavior", () => {
  for(const env of [
    {VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"main"},
    {NODE_ENV:"production"},
  ]) {
    assert.doesNotThrow(() => assertQaPreviewIsolation(env));
  }
});

test("Production requires the operational database and rejects QA overrides",()=>{
 const production={VERCEL_ENV:"production",SUPABASE_URL:OPERATIONAL_SUPABASE_ORIGIN,SUPABASE_PUBLISHABLE_KEY:"synthetic-public-key"};
 assert.doesNotThrow(()=>assertQaPreviewIsolation(production));
 for(const override of [{SUPABASE_URL:QA_SUPABASE_ORIGIN},{SUPABASE_URL:undefined},{SUPABASE_PUBLISHABLE_KEY:undefined},{QA_BRANCH_ISOLATION:QA_SUPABASE_PROJECT}]){
  assert.throws(()=>assertQaPreviewIsolation({...production,...override}),/Production database isolation/);
 }
});

test("DB boundary is enforced before protected and public Supabase requests", () => {
  const read=path=>readFileSync(path,"utf8");
  for(const file of ["proxy.ts","lib/supabase/server.ts","app/k/[token]/page.tsx","lib/laundry/card.ts"]){
    assert.match(read(file),/assertQaPreviewIsolation\(\)/,file);
  }
  assert.ok(read("proxy.ts").indexOf(" assertQaPreviewIsolation();") < read("proxy.ts").indexOf(" const url=process.env.SUPABASE_URL"));
  assert.ok(read("app/k/[token]/page.tsx").indexOf("assertQaPreviewIsolation();") < read("app/k/[token]/page.tsx").indexOf("const url=process.env.SUPABASE_URL"));
});

test("QA readiness endpoint is preview-only, non-sensitive and uncached", () => {
  const route=readFileSync("app/api/qa-readiness/route.ts","utf8");
  assert.match(route, /qaPreviewIsolation: "configured"/);
  assert.match(route, /qaPreviewIsolation: "blocked"/);
  assert.match(route, /VERCEL_GIT_COMMIT_REF !== QA_PREVIEW_REF/);
  assert.match(route, /status: 404/);
  assert.match(route, /status: 503/);
  assert.match(route, /no-store/);
  assert.doesNotMatch(route, /service_role|createClient\(|laundry_members|token_ciphertext/);
});
