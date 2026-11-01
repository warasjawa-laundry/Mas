import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as boundary from "../lib/supabase/qa-preview-isolation.ts";

const require = createRequire(import.meta.url);
const qaRef = "cwxsbgfjynwxqalwonae";
const operationalRef = "hncfyfvqtlnvqyfrydzb";
const jwt = (ref, role = "anon") =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ ref, role })).toString("base64url")}.fixture-signature`;
const qaKeys = ["sb_publishable_fixture_qa", jwt(qaRef)];
const operationalKeys = ["sb_publishable_fixture_operational", jwt(operationalRef)];
const hash = key => createHash("sha256").update(key, "utf8").digest("hex");
const policy = {
  qaKeyFingerprints: qaKeys.map(hash),
  operationalKeyFingerprints: operationalKeys.map(hash),
};
const qa = {
  VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature/pos-foundation-v2",
  LAUNDRY_DATABASE_MODE: "qa", QA_BRANCH_ISOLATION: qaRef,
  SUPABASE_URL: `https://${qaRef}.supabase.co`, SUPABASE_PUBLISHABLE_KEY: qaKeys[0],
};
const operational = {
  VERCEL_ENV: "production", SUPABASE_URL: `https://${operationalRef}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: operationalKeys[0],
};
const check = env => boundary.assertDatabaseBoundary(env, policy);

test("runtime fingerprint declarations do not replace the trusted policy", () => {
  assert.doesNotThrow(() => check({
    ...qa, QA_SUPABASE_KEY_SHA256: "wrong-runtime-hash", SUPABASE_EXPECTED_KEY_HASH: "wrong-runtime-hash",
  }));
  const unknownKey = "sb_publishable_unknown-runtime-key";
  assert.throws(() => check({
    ...qa, SUPABASE_PUBLISHABLE_KEY: unknownKey,
    QA_SUPABASE_KEY_SHA256: hash(unknownKey), SUPABASE_EXPECTED_KEY_HASH: hash(unknownKey),
  }));
});

test("all Preview branch names accept only the explicit QA project and registered key", () => {
  for (const branch of ["main", "feature/pos-foundation-v2", "renamed-feature", undefined]) {
    for (const key of qaKeys) {
      assert.doesNotThrow(() => check({ ...qa, VERCEL_GIT_COMMIT_REF: branch, SUPABASE_PUBLISHABLE_KEY: key }));
    }
  }
});

test("QA origin, marker, mode and key pairing are independently required", () => {
  for (const override of [
    { LAUNDRY_DATABASE_MODE: undefined }, { LAUNDRY_DATABASE_MODE: "single" },
    { QA_BRANCH_ISOLATION: undefined }, { QA_BRANCH_ISOLATION: "tnadzytuamdxfypoeggy" },
    { SUPABASE_URL: operational.SUPABASE_URL },
    { SUPABASE_URL: `${qa.SUPABASE_URL}/` }, { SUPABASE_URL: `${qa.SUPABASE_URL}.evil.invalid` },
    { SUPABASE_URL: "https://tnadzytuamdxfypoeggy.supabase.co" },
    { SUPABASE_PUBLISHABLE_KEY: undefined }, { SUPABASE_PUBLISHABLE_KEY: "sb_publishable_rotated-but-unreviewed" },
    ...operationalKeys.map(key => ({ SUPABASE_PUBLISHABLE_KEY: key })),
  ]) {
    assert.throws(() => check({ ...qa, ...override }));
  }
});

test("Preview rejects privileged keys, alternate client credentials and direct DB configuration", () => {
  for (const name of [
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "DATABASE_URL", "DIRECT_URL", "POSTGRES_URL", "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL", "POSTGRES_PASSWORD", "PGPASSWORD", "PGHOST", "SUPABASE_DB_URL",
  ]) {
    assert.throws(() => check({ ...qa, [name]: "fixture-sensitive-value" }), name);
  }
  for (const key of ["sb_secret_fixture", jwt(qaRef, "service_role"), jwt(operationalRef), "malformed"]) {
    assert.throws(() => check({ ...qa, SUPABASE_PUBLISHABLE_KEY: key }));
  }
});

test("a fingerprint cannot bless a malformed, privileged or wrongly paired JWT", () => {
  for (const key of ["not-a-key", "sb_secret_fixture", jwt(qaRef, "service_role"), jwt(operationalRef)]) {
    assert.throws(() => boundary.assertDatabaseBoundary(
      { ...qa, SUPABASE_PUBLISHABLE_KEY: key },
      { ...policy, qaKeyFingerprints: [hash(key)] },
    ));
  }
});

test("production preserves both registered key formats and single mode", () => {
  for (const key of operationalKeys) {
    for (const mode of [undefined, "single"]) {
      assert.doesNotThrow(() => check({ ...operational, LAUNDRY_DATABASE_MODE: mode, SUPABASE_PUBLISHABLE_KEY: key }));
    }
  }
  for (const override of [
    { SUPABASE_URL: qa.SUPABASE_URL }, { SUPABASE_PUBLISHABLE_KEY: qaKeys[0] },
    { QA_BRANCH_ISOLATION: qaRef }, { LAUNDRY_DATABASE_MODE: "qa" }, { LAUNDRY_DATABASE_MODE: "typo" },
    { SUPABASE_PUBLISHABLE_KEY: "sb_publishable_unknown-production-rotation" },
  ]) assert.throws(() => check({ ...operational, ...override }));
});

test("Vercel production CI builds can read the operational configuration", () => {
  for (const key of operationalKeys) {
    for (const mode of [undefined, "single"]) {
      for (const CI of ["1", "true"]) {
        assert.doesNotThrow(() => check({
          ...operational, SUPABASE_PUBLISHABLE_KEY: key, LAUNDRY_DATABASE_MODE: mode, VERCEL: "1", CI,
        }));
      }
    }
  }
});

test("GitHub and explicit test runners cannot use production even with Vercel metadata", () => {
  for (const marker of [{ GITHUB_ACTIONS: "true" }, { LAUNDRY_TEST_RUNNER: "1" }]) {
    for (const VERCEL of [undefined, "1"]) {
      for (const CI of [undefined, "1", "true", "false"]) {
        assert.throws(() => check({ ...operational, VERCEL, CI, ...marker }));
        assert.throws(() => check({ ...operational, VERCEL_ENV: undefined, LAUNDRY_DATABASE_MODE: "single", VERCEL, CI, ...marker }));
      }
    }
  }
});

test("generic CI cannot authorize production by declaring only Vercel or environment metadata", () => {
  for (const env of [
    { ...operational, CI: "1" },
    { ...operational, CI: "true" },
    { ...operational, VERCEL: "0", CI: "1" },
    { ...operational, VERCEL_ENV: undefined, LAUNDRY_DATABASE_MODE: "single", VERCEL: "1", CI: "1" },
    { ...operational, VERCEL_ENV: "development", LAUNDRY_DATABASE_MODE: "single", VERCEL: "1", CI: "1" },
  ]) assert.throws(() => check(env));
});

test("Vercel build metadata never enables operational credentials in any Preview branch", () => {
  for (const branch of [undefined, "main", "feature/pos-foundation-v2", "renamed-feature"]) {
    assert.throws(() => check({
      ...operational, VERCEL: "1", CI: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch,
      LAUNDRY_DATABASE_MODE: "single",
    }));
    assert.doesNotThrow(() => check({ ...qa, VERCEL: "1", CI: "1", VERCEL_GIT_COMMIT_REF: branch }));
  }
});

test("local and CI configured database use requires an explicit environment", () => {
  assert.doesNotThrow(() => check({ ...qa, VERCEL_ENV: undefined }));
  assert.doesNotThrow(() => check({ ...qa, VERCEL_ENV: undefined, CI: "true" }));
  assert.doesNotThrow(() => check({ ...operational, VERCEL_ENV: undefined, LAUNDRY_DATABASE_MODE: "single" }));
  for (const env of [
    { ...operational, VERCEL_ENV: undefined },
    { ...operational, CI: "true" },
    { ...operational, VERCEL_ENV: undefined, LAUNDRY_DATABASE_MODE: "single", CI: "true" },
    { DATABASE_URL: "fixture-sensitive-value" }, { CI: "true", POSTGRES_URL: "fixture-sensitive-value" },
    { NEXT_PUBLIC_SUPABASE_URL: operational.SUPABASE_URL },
    { ...qa, VERCEL_ENV: "unexpected-provider-mode" },
  ]) assert.throws(() => check(env));
});

function route(env, guard = () => boundary.assertQaPreviewIsolation(env)) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync("app/api/qa-readiness/route.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  runInNewContext(compiled, {
    exports: module.exports, module, process: { env }, Response,
    require: name => {
      if (name === "next/server") return require(name);
      assert.equal(name, "@/lib/supabase/qa-preview-isolation");
      return { ...boundary, assertQaPreviewIsolation: guard };
    },
  });
  return module.exports.GET();
}

test("readiness returns an uncached blocked response for every misconfigured Preview branch", async () => {
  for (const branch of ["main", "new-feature", "feature/pos-foundation-v2", undefined]) {
    for (const mode of [undefined, "single"]) {
      const response = await route({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: branch, LAUNDRY_DATABASE_MODE: mode });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { qaPreviewIsolation: "blocked" });
      assert.match(response.headers.get("cache-control"), /no-store/);
    }
  }
});

test("readiness confirms configuration without returning credentials or database identity", async () => {
  const response = await route(qa, () => check(qa));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { qaPreviewIsolation: "configured" });
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("readiness is absent outside Preview", async () => {
  for (const VERCEL_ENV of [undefined, "development", "production"]) {
    const response = await route({ ...qa, VERCEL_ENV });
    assert.equal(response.status, 404);
    assert.equal(await response.text(), "");
  }
});
