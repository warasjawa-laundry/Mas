import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { assertQaPreviewIsolation } from "../lib/supabase/qa-preview-isolation.ts";

const qaOrigin = "https://cwxsbgfjynwxqalwonae.supabase.co";
const productionOrigin = "https://hncfyfvqtlnvqyfrydzb.supabase.co";
const preview = {
  VERCEL_ENV: "preview",
  LAUNDRY_DATABASE_MODE: "qa",
  QA_BRANCH_ISOLATION: "cwxsbgfjynwxqalwonae",
  SUPABASE_URL: qaOrigin,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_unregistered-key",
};

test("every Preview branch fails closed without QA configuration", () => {
  for (const branch of ["main", "new-feature-name", "feature/pos-foundation-v2", undefined]) {
    assert.throws(() => assertQaPreviewIsolation({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch }));
  }
});

test("single mode cannot redirect a Preview deployment to production", () => {
  assert.throws(() => assertQaPreviewIsolation({
    VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main", LAUNDRY_DATABASE_MODE: "single",
    SUPABASE_URL: productionOrigin, SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  }));
});

test("runtime environment cannot authorize an unregistered public key", () => {
  for (const key of ["sb_publishable_unregistered-key", "qa-only", "", undefined]) {
    assert.throws(() => assertQaPreviewIsolation({
      ...preview, SUPABASE_PUBLISHABLE_KEY: key,
      QA_SUPABASE_KEY_SHA256: createHash("sha256").update(key ?? "").digest("hex"),
      SUPABASE_EXPECTED_KEY_HASH: createHash("sha256").update(key ?? "").digest("hex"),
    }));
  }
});

test("the retired QA project cannot be reused for Preview", () => {
  assert.throws(() => assertQaPreviewIsolation({
    ...preview, VERCEL_GIT_COMMIT_REF: "feature/admin-operations-reliability-20261017",
    QA_BRANCH_ISOLATION: "tnadzytuamdxfypoeggy",
    SUPABASE_URL: "https://tnadzytuamdxfypoeggy.supabase.co", SUPABASE_PUBLISHABLE_KEY: "retired-qa-key",
  }));
});

test("standalone public builds and CI without database settings remain available", () => {
  for (const env of [{}, { NODE_ENV: "production" }, { CI: "true" }, { VERCEL_ENV: "development" }]) {
    assert.doesNotThrow(() => assertQaPreviewIsolation(env));
  }
});

test("local configured databases require an explicit reviewed environment mode", () => {
  assert.throws(() => assertQaPreviewIsolation({
    SUPABASE_URL: productionOrigin, SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  }));
});

test("CI rejects operational credentials even when single mode is selected", () => {
  for (const VERCEL_ENV of [undefined, "production", "preview"]) {
    assert.throws(() => assertQaPreviewIsolation({
      CI: "true", VERCEL_ENV, LAUNDRY_DATABASE_MODE: "single",
      SUPABASE_URL: productionOrigin, SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
    }));
  }
});

test("production rejects an unknown key and QA inheritance", () => {
  for (const extra of [{}, { QA_BRANCH_ISOLATION: "cwxsbgfjynwxqalwonae" }, { LAUNDRY_DATABASE_MODE: "qa" }]) {
    assert.throws(() => assertQaPreviewIsolation({
      VERCEL_ENV: "production", SUPABASE_URL: productionOrigin,
      SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key", ...extra,
    }));
  }
});

test("existing Supabase request entry points retain the boundary check", () => {
  for (const file of ["proxy.ts", "lib/supabase/server.ts", "app/k/[token]/page.tsx", "lib/laundry/card.ts", "lib/services/server.ts"]) {
    assert.match(readFileSync(file, "utf8"), /assertQaPreviewIsolation\(\)/, file);
  }
});
