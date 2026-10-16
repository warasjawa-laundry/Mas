export function extractLaundryToken(raw: string) {
  const value = raw.trim();
  // A QR card URL is a bearer credential. Parse locally; never fetch untrusted URLs.
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  if (value.length > 500) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (host !== "masjawalaundry.web.id" &&
      host !== "masjawalaundry.vercel.app" &&
      !/^masjawalaundry-[a-z0-9-]+-ombotak-property-s-projects\.vercel\.app$/.test(host)) return null;
  const match = /^\/k\/([A-Za-z0-9_-]{43})\/?$/.exec(url.pathname);
  return match ? match[1] : null;
}
