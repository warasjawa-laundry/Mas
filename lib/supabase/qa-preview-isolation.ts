/**
 * Database boundaries for the isolated owner UAT and operational production.
 *
 * Vercel project 'mas' inherits shared Preview variables which may point to
 * the customer database. Refuse all QA-feature requests unless the
 * branch-specific override is actually present in the running deployment.
 * No keys, tokens or credentials are written to logs.
 */
export const QA_PREVIEW_REF = "feature/admin-operations-reliability-20261017";
export const QA_SUPABASE_PROJECT = "tnadzytuamdxfypoeggy";
export const QA_SUPABASE_ORIGIN = "https://tnadzytuamdxfypoeggy.supabase.co";
export const OPERATIONAL_SUPABASE_ORIGIN = "https://hncfyfvqtlnvqyfrydzb.supabase.co";

export function assertQaPreviewIsolation(env: NodeJS.ProcessEnv = process.env): void {
  if(env.LAUNDRY_DATABASE_MODE==="single"){
    if(env.SUPABASE_URL!==OPERATIONAL_SUPABASE_ORIGIN||
       !env.SUPABASE_PUBLISHABLE_KEY||env.QA_BRANCH_ISOLATION){
      throw new Error("Single-project database is not configured");
    }
    return;
  }
  // Production must never inherit the QA database or its branch marker.
  if (env.VERCEL_ENV === "production") {
    if (env.SUPABASE_URL !== OPERATIONAL_SUPABASE_ORIGIN ||
        !env.SUPABASE_PUBLISHABLE_KEY || env.QA_BRANCH_ISOLATION) {
      throw new Error("Production database isolation is not configured");
    }
    return;
  }
  if (env.VERCEL_ENV !== "preview" || env.VERCEL_GIT_COMMIT_REF !== QA_PREVIEW_REF) return;
  if (env.QA_BRANCH_ISOLATION !== QA_SUPABASE_PROJECT ||
      env.SUPABASE_URL !== QA_SUPABASE_ORIGIN ||
      !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("QA Preview database isolation is not configured");
  }
}
