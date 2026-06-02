import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dome.ca";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/profile", "/bookings", "/book/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
