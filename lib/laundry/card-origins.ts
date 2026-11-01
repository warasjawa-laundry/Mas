export const OFFICIAL_CARD_ORIGIN = "https://masjawalaundry.web.id";
export const REVIEW_CARD_ORIGIN =
  "https://mas-git-main-m8traders-projects-081d9dc2.vercel.app";
// Retained for reading previously issued QA cards, never for new card destinations.
export const QA_REVIEW_BRANCH = "feature/admin-operations-reliability-20261017";
export const QA_CARD_ORIGIN =
  "https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app";

export function cardOriginForEnvironment(
  vercelEnv: string | undefined,
  nodeEnv: string | undefined,
  _gitBranch?: string,
  qaOrigin?: string,
): string {
  if (vercelEnv === "preview") {
    try {
      const url = new URL(qaOrigin ?? "");
      if (url.protocol === "https:" && url.origin === qaOrigin &&
          !url.username && !url.password && !url.port && !url.search && !url.hash &&
          /^mas-git-[a-z0-9-]+-m8traders-projects-081d9dc2\.vercel\.app$/.test(url.hostname) &&
          qaOrigin !== REVIEW_CARD_ORIGIN && qaOrigin !== QA_CARD_ORIGIN) return qaOrigin;
    } catch {}
    throw new Error("QA card origin is not configured");
  }
  if (nodeEnv !== "production") return "http://localhost:3000";
  return OFFICIAL_CARD_ORIGIN;
}
