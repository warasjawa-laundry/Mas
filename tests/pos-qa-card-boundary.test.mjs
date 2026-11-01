import test from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { assertDatabaseBoundary } from "../lib/supabase/qa-preview-isolation.ts";
import * as origins from "../lib/laundry/card-origins.ts";
import * as cardCrypto from "../lib/laundry/card-crypto.ts";

const qaPublicKey = "sb_publishable_fixture_qa_card";
const operationalPublicKey = "sb_publishable_fixture_operational_card";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const policy = { qaKeyFingerprints: [hash(qaPublicKey)], operationalKeyFingerprints: [hash(operationalPublicKey)] };
const qaKey = Buffer.alloc(32, 11).toString("base64");
const operationalKey = Buffer.alloc(32, 22).toString("base64");
const legacyKey = Buffer.alloc(32, 33).toString("base64");
const qaOrigin = "https://mas-git-pos-qa-m8traders-projects-081d9dc2.vercel.app";
const qa = {
  VERCEL_ENV: "preview", NODE_ENV: "production", LAUNDRY_DATABASE_MODE: "qa",
  QA_BRANCH_ISOLATION: "cwxsbgfjynwxqalwonae", SUPABASE_URL: "https://cwxsbgfjynwxqalwonae.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: qaPublicKey, QA_CARD_ORIGIN: qaOrigin,
  LAUNDRY_CARD_ENCRYPTION_KEY_QA: qaKey,
  LAUNDRY_CARD_ENCRYPTION_KEY_OPERATIONAL: operationalKey, LAUNDRY_CARD_ENCRYPTION_KEY: legacyKey,
};
const production = {
  VERCEL_ENV: "production", NODE_ENV: "production", LAUNDRY_DATABASE_MODE: "single",
  SUPABASE_URL: "https://hncfyfvqtlnvqyfrydzb.supabase.co", SUPABASE_PUBLISHABLE_KEY: operationalPublicKey,
  LAUNDRY_CARD_ENCRYPTION_KEY_OPERATIONAL: operationalKey, LAUNDRY_CARD_ENCRYPTION_KEY: legacyKey,
  LAUNDRY_CARD_ENCRYPTION_KEY_QA: qaKey,
};

function load(path, env, guard = () => assertDatabaseBoundary(env, policy)) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const dependencies = {
    "server-only": {}, "node:crypto": crypto,
    "@/lib/supabase/qa-preview-isolation": { assertQaPreviewIsolation: guard },
    "@/lib/laundry/card-origins": origins, "@/lib/laundry/card-crypto": cardCrypto,
    "@supabase/supabase-js": {}, "./defaults": { defaultServices: [] },
  };
  runInNewContext(compiled, {
    exports: module.exports, module, process: { env }, Buffer,
    require: name => { assert.ok(name in dependencies, name); return dependencies[name]; },
  });
  return module.exports;
}
const card = env => load("lib/laundry/card.ts", env);
const realtime = env => load("lib/services/server.ts", env).catalogRealtimeConfig();
const token = Buffer.alloc(32, 44).toString("base64url");
function encrypted(key) {
  const iv = Buffer.alloc(12, 55);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  return Buffer.concat([iv, cipher.update(token, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("hex");
}

test("QA encryption uses only its own key despite inherited operational and legacy variables", () => {
  for (const VERCEL_ENV of ["preview", undefined, "development"]) {
    const api = card({ ...qa, VERCEL_ENV });
    const ciphertext = api.encryptCardToken(token);
    assert.equal(cardCrypto.decryptCardWithKeys(ciphertext, Buffer.from(qaKey, "base64")), token);
    for (const key of [operationalKey, legacyKey]) {
      assert.throws(() => cardCrypto.decryptCardWithKeys(ciphertext, Buffer.from(key, "base64")));
      assert.throws(() => api.decryptCardToken(encrypted(key)));
    }
    assert.equal(api.decryptCardToken(encrypted(qaKey)), token);
  }
});

test("missing or invalid QA key disables issuance without borrowing operational material", () => {
  for (const key of [undefined, "", "malformed", Buffer.alloc(31).toString("base64")]) {
    const api = card({ ...qa, LAUNDRY_CARD_ENCRYPTION_KEY_QA: key });
    assert.equal(api.cardIssuanceReady(), false);
    assert.throws(() => api.encryptCardToken(token));
    assert.throws(() => api.decryptCardToken(encrypted(operationalKey)));
  }
});

test("QA issuance requires its approved origin while decryption does not depend on printing configuration", () => {
  for (const origin of [undefined, origins.REVIEW_CARD_ORIGIN, origins.QA_CARD_ORIGIN]) {
    const api = card({ ...qa, QA_CARD_ORIGIN: origin });
    assert.equal(api.cardIssuanceReady(), false);
    assert.throws(() => api.publicCardOrigin());
    assert.equal(api.decryptCardToken(encrypted(qaKey)), token);
  }
  for (const VERCEL_ENV of ["preview", undefined]) {
    const api = card({ ...qa, VERCEL_ENV });
    assert.equal(api.publicCardOrigin(), qaOrigin);
    assert.equal(api.cardIssuanceReady(), true);
  }
});

test("production retains operational primary and legacy fallback decryption", () => {
  const api = card(production);
  assert.equal(api.cardIssuanceReady(), true);
  assert.equal(api.publicCardOrigin(), origins.OFFICIAL_CARD_ORIGIN);
  assert.equal(api.decryptCardToken(encrypted(operationalKey)), token);
  assert.equal(api.decryptCardToken(encrypted(legacyKey)), token);
  assert.throws(() => api.decryptCardToken(encrypted(qaKey)));
  assert.equal(cardCrypto.decryptCardWithKeys(api.encryptCardToken(token), Buffer.from(operationalKey, "base64")), token);
  const legacyOnly = card({ ...production, LAUNDRY_CARD_ENCRYPTION_KEY_OPERATIONAL: undefined });
  assert.equal(legacyOnly.decryptCardToken(encrypted(legacyKey)), token);
  assert.equal(cardCrypto.decryptCardWithKeys(legacyOnly.encryptCardToken(token), Buffer.from(legacyKey, "base64")), token);
});

test("Realtime config refuses Preview credentials before returning any browser key", () => {
  for (const extra of [
    { LAUNDRY_DATABASE_MODE: "single", SUPABASE_URL: production.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: operationalPublicKey },
    { SUPABASE_URL: production.SUPABASE_URL }, { SUPABASE_PUBLISHABLE_KEY: "sb_publishable_unknown" },
    { LAUNDRY_DATABASE_MODE: undefined }, { SUPABASE_URL: undefined },
  ]) assert.throws(() => realtime({ ...qa, ...extra }));
  assert.throws(() => realtime({ ...production, CI: "true" }));
  assert.equal(realtime(qa).key, qaPublicKey);
  assert.equal(realtime(production).key, operationalPublicKey);
  assert.equal(realtime({}), null);
});

test("Realtime invokes a rejecting boundary before even reading browser credentials", () => {
  const refusal = new Error("boundary refused");
  const env = { ...qa };
  Object.defineProperty(env, "SUPABASE_PUBLISHABLE_KEY", {
    get() { assert.fail("browser key was read before the boundary guard"); },
  });
  const api = load("lib/services/server.ts", env, () => { throw refusal; });
  assert.throws(() => api.catalogRealtimeConfig(), error => error === refusal);
});
