import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://drainguard-ai-earth.vercel.app/sitemap.xml",
  };
}
