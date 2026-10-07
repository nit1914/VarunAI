import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://drainguard-ai-earth.vercel.app",
    lastModified: new Date("2026-08-15"),
    changeFrequency: "weekly",
    priority: 1,
  }];
}
