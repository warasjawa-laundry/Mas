import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/k/", "/api/"] }],
    sitemap: site.baseUrl + "/sitemap.xml",
    host: site.baseUrl,
  };
}
