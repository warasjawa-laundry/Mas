import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.baseUrl, changeFrequency: "monthly", priority: 1 },
    { url: site.baseUrl + "/membership", changeFrequency: "monthly", priority: 0.5 },
  ];
}
