import { createHash } from "node:crypto";

export const QA_PREVIEW_REF = "feature/pos-foundation-v2";
export const QA_SUPABASE_PROJECT = "cwxsbgfjynwxqalwonae";
export const QA_SUPABASE_ORIGIN = "https://cwxsbgfjynwxqalwonae.supabase.co";
export const OPERATIONAL_SUPABASE_ORIGIN = "https://hncfyfvqtlnvqyfrydzb.supabase.co";
const OPERATIONAL_SUPABASE_PROJECT = "hncfyfvqtlnvqyfrydzb";

export type DatabaseBoundaryPolicy = Readonly<{
  qaKeyFingerprints: readonly string[];
  operationalKeyFingerprints: readonly string[];
}>;

// Key rotations require a reviewed registry update; runtime env cannot authorize a key.
const trustedPolicy: DatabaseBoundaryPolicy = Object.freeze({
  qaKeyFingerprints: Object.freeze([
    "fa22e33077aee4a6041e9bacce49b1ad86c5fae172ecaf06addc5d3404210e4e",
    "2c518708671470564110e93f0206d675e13323c43ceb8bc81d50a0c1da70f37a",
  ]),
  operationalKeyFingerprints: Object.freeze([
    "352a97ebc91cbd095933722ece14da67b5f7cfdfd0a315a1d42c3af0b404b01e",
    "fd454a251dc9796a714a54d4921d06045d06c58e02554e98aab5f342bd639757",
  ]),
});

function hasAlternateDatabaseConfiguration(env: NodeJS.ProcessEnv): boolean {
  return Object.entries(env).some(([name, value]) => {
    if (!value || name === "SUPABASE_URL" || name === "SUPABASE_PUBLISHABLE_KEY" ||
        name === "QA_SUPABASE_KEY_SHA256" || name === "SUPABASE_EXPECTED_KEY_HASH") return false;
    return /(?:^|_)SUPABASE_/.test(name) ||
      /(?:^|_)(?:DATABASE_URL|DIRECT_URL|POSTGRES(?:QL)?(?:_|$))/.test(name) ||
      /^PG(?:HOST|HOSTADDR|PORT|USER|PASSWORD|DATABASE|SERVICE|SERVICEFILE|PASSFILE|SSLMODE)$/.test(name);
  });
}

function registeredPublicKey(key: string | undefined, project: string, fingerprints: readonly string[]): boolean {
  if (!key) return false;
  if (!key.startsWith("sb_publishable_")) {
    try {
      const parts = key.split(".");
      if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return false;
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload.ref !== project || payload.role !== "anon") return false;
    } catch {
      return false;
    }
  }
  // JWT claims alone do not prove provenance; both key formats need a pinned digest.
  return fingerprints.includes(createHash("sha256").update(key, "utf8").digest("hex"));
}

export function assertDatabaseBoundary(env: NodeJS.ProcessEnv, policy: DatabaseBoundaryPolicy): void {
  const alternateConfiguration = hasAlternateDatabaseConfiguration(env);
  const ci = Boolean(env.CI && env.CI !== "false" && env.CI !== "0");
  const testRunner = env.LAUNDRY_TEST_RUNNER === "1" || env.GITHUB_ACTIONS === "true";
  // Vercel sets CI during production builds; explicit test runners still reject production.
  const vercelProduction = env.VERCEL === "1" && env.VERCEL_ENV === "production";
  const operationalCiBlocked = testRunner || (ci && !vercelProduction);
  const mode = env.LAUNDRY_DATABASE_MODE;
  if (env.VERCEL_ENV === "preview" || mode === "qa") {
    if ((env.VERCEL_ENV && !["preview", "development"].includes(env.VERCEL_ENV)) ||
        mode !== "qa" || env.QA_BRANCH_ISOLATION !== QA_SUPABASE_PROJECT ||
        env.SUPABASE_URL !== QA_SUPABASE_ORIGIN || alternateConfiguration ||
        !registeredPublicKey(env.SUPABASE_PUBLISHABLE_KEY, QA_SUPABASE_PROJECT, policy.qaKeyFingerprints)) {
      throw new Error("QA Preview database isolation is not configured");
    }
    return;
  }

  if (env.VERCEL_ENV === "production" || mode === "single") {
    if ((env.VERCEL_ENV && !["production", "development"].includes(env.VERCEL_ENV)) ||
        operationalCiBlocked || (mode && mode !== "single") || env.QA_BRANCH_ISOLATION ||
        env.SUPABASE_URL !== OPERATIONAL_SUPABASE_ORIGIN || alternateConfiguration ||
        !registeredPublicKey(env.SUPABASE_PUBLISHABLE_KEY, OPERATIONAL_SUPABASE_PROJECT, policy.operationalKeyFingerprints)) {
      throw new Error("Production database isolation is not configured");
    }
    return;
  }

  if (env.SUPABASE_URL || env.SUPABASE_PUBLISHABLE_KEY || alternateConfiguration || mode || env.QA_BRANCH_ISOLATION) {
    throw new Error("Database environment mode is not configured");
  }
}

export function assertQaPreviewIsolation(env: NodeJS.ProcessEnv = process.env): void {
  assertDatabaseBoundary(env, trustedPolicy);
}
