import { OFFICIAL_CARD_ORIGIN, REVIEW_CARD_ORIGIN } from "./card-origins.ts";

const allowedHosts = new Set([
  new URL(OFFICIAL_CARD_ORIGIN).hostname,
  new URL(REVIEW_CARD_ORIGIN).hostname,
  "masjawalaundry.vercel.app",
]);

// Read previously generated QA cards without trusting arbitrary *.vercel.app
// links. Their embedded one-off host is only used to extract a token locally.
const knownLegacyPreview =
  /^mas-[a-z0-9]+-m8traders-projects-081d9dc2\.vercel\.app$/;
const knownLegacyProduction =
  /^masjawalaundry-[a-z0-9-]+-ombotak-property-s-projects\.vercel\.app$/;

export function extractLaundryToken(raw: string) {
  const value = raw.trim();
  // A QR card URL is a bearer credential. Parse locally; never fetch untrusted URLs.
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  if (value.length > 500) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.has(host) && !knownLegacyPreview.test(host) &&
      !knownLegacyProduction.test(host)) return null;
  const match = /^\/k\/([A-Za-z0-9_-]{43})\/?$/.exec(url.pathname);
  return match ? match[1] : null;
}
