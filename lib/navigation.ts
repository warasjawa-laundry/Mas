/**
 * Public-site navigation. When users start from a one-off Vercel Preview URL,
 * send internal public links to the fixed Preview branch alias so homepage,
 * membership, and owner-login destinations all use the same current build.
 *
 * The override must never affect Netlify or the official Production site.
 * Do not use this helper for QR bearer-token links or authenticated redirects.
 */
const REVIEW_ALIAS_HOST = "mas-git-main-m8traders-projects-081d9dc2.vercel.app";

export function siteHref(path: string): string {
  // The variable is configured only on the unyil project's Preview target.
  // Production is protected even if the variable is accidentally copied.
  if (process.env.VERCEL_ENV === "production") return path;

  const configuredOrigin = process.env.REVIEW_NAV_ORIGIN;
  if (!configuredOrigin || !path.startsWith("/") || path.startsWith("//")) {
    return path;
  }

  try {
    const url = new URL(configuredOrigin);
    if (
      url.protocol !== "https:" ||
      url.hostname !== REVIEW_ALIAS_HOST ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return path;
    }
    return `${url.origin}${path}`;
  } catch {
    return path;
  }
}
