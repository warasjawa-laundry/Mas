import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  QA_PREVIEW_REF,
  QA_SUPABASE_ORIGIN,
  QA_SUPABASE_PROJECT,
  assertQaPreviewIsolation,
} from "../lib/supabase/qa-preview-isolation.ts";

const preview = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: QA_PREVIEW_REF,
};

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

test("Main Preview and production are unaffected", () => {
  for(const env of [
    {VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"main"},
    {VERCEL_ENV:"production",VERCEL_GIT_COMMIT_REF:QA_PREVIEW_REF},
    {NODE_ENV:"production"},
  ]) {
    assert.doesNotThrow(() => assertQaPreviewIsolation(env));
  }
});

test("DB boundary is enforced before protected and public Supabase requests", () => {
  const read=path=>readFileSync(path,"utf8");
  for(const file of ["proxy.ts","lib/supabase/server.ts","app/k/[token]/page.tsx","lib/laundry/card.ts"]){
    assert.match(read(file),/assertQaPreviewIsolation\(\)/,file);
  }
  assert.ok(read("proxy.ts").indexOf("  assertQaPreviewIsolation();") < read("proxy.ts").indexOf("  const url = process.env.SUPABASE_URL;"));
  assert.ok(read("app/k/[token]/page.tsx").indexOf("  assertQaPreviewIsolation();") < read("app/k/[token]/page.tsx").indexOf("  const url=process.env.SUPABASE_URL;"));
});
