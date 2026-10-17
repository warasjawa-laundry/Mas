/**
 * Safety boundary for the isolated owner UAT deployment.
 *
 * Vercel project 'mas' inherits shared Preview variables which may point to
 * the customer database. Refuse all QA-feature requests unless the
 * branch-specific override is actually present in the running deployment.
 * No keys, tokens or credentials are written to logs.
 */
export const QA_PREVIEW_REF = "feature/admin-operations-reliability-20261017";
export const QA_SUPABASE_PROJECT = "tnadzytuamdxfypoeggy";
export const QA_SUPABASE_ORIGIN = "https://tnadzytuamdxfypoeggy.supabase.co";

export function assertQaPreviewIsolation(env: NodeJS.ProcessEnv = process.env): void {
  if (env.VERCEL_ENV !== "preview" || env.VERCEL_GIT_COMMIT_REF !== QA_PREVIEW_REF) return;
  if (env.QA_BRANCH_ISOLATION !== QA_SUPABASE_PROJECT ||
      env.SUPABASE_URL !== QA_SUPABASE_ORIGIN ||
      !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("QA Preview database isolation is not configured");
  }
}
