import type { MetadataRoute } from "next";
import { API_URL } from "../lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dome.ca";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/facilities`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/connect`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.7 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const res = await fetch(`${API_URL}/facilities?limit=500`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const json = (await res.json()) as { data: Array<{ id: string; updatedAt?: string }> };
      const facilityRoutes: MetadataRoute.Sitemap = (json.data ?? []).map((f) => ({
        url: `${base}/facilities/${f.id}`,
        lastModified: f.updatedAt ? new Date(f.updatedAt) : new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));
      return [...staticRoutes, ...facilityRoutes];
    }
  } catch {}

  return staticRoutes;
}
