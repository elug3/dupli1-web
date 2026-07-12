import {
  BRAND_SLUGS,
  FAMILY_SLUGS,
  PRODUCT_TYPE_SLUGS,
  STYLE_SLUGS,
  type CategoryFacet,
} from "~/lib/catalog";
import { fetchUpstreamBags } from "~/lib/product-upstream.server";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: number;
}

const FACETS: CategoryFacet[] = ["product-type", "brand", "style", "family"];

const FACET_OPTIONS: Record<CategoryFacet, string[]> = {
  "product-type": Object.keys(PRODUCT_TYPE_SLUGS),
  brand: Object.keys(BRAND_SLUGS),
  style: Object.keys(STYLE_SLUGS),
  family: Object.keys(FAMILY_SLUGS),
};

export function siteOrigin(): string {
  const configured =
    process.env.DUPLI1_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "https://dupli1.com";

  return configured.replace(/\/+$/, "");
}

function absolute(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function staticSitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [
    { loc: absolute("/"), changefreq: "daily", priority: 1 },
    { loc: absolute("/login"), changefreq: "monthly", priority: 0.3 },
    { loc: absolute("/history"), changefreq: "monthly", priority: 0.2 },
  ];

  for (const facet of FACETS) {
    entries.push({
      loc: absolute(`/category/${facet}`),
      changefreq: "weekly",
      priority: 0.7,
    });

    for (const value of FACET_OPTIONS[facet]) {
      entries.push({
        loc: absolute(`/category/${facet}/${value}`),
        changefreq: "daily",
        priority: facet === "brand" ? 0.9 : 0.8,
      });
    }
  }

  return entries;
}

export async function productSitemapEntries(): Promise<SitemapEntry[]> {
  try {
    const bags = await fetchUpstreamBags();
    const lastmod = today();

    return bags.map((bag) => ({
      loc: absolute(`/product/${encodeURIComponent(bag.id)}`),
      lastmod,
      changefreq: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}

export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  const seen = new Set<string>();
  const entries = [...staticSitemapEntries(), ...(await productSitemapEntries())];

  return entries.filter((entry) => {
    if (seen.has(entry.loc)) return false;
    seen.add(entry.loc);
    return true;
  });
}

export function renderSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const lines = [`    <url>`, `        <loc>${escapeXml(entry.loc)}</loc>`];

      if (entry.lastmod) {
        lines.push(`        <lastmod>${entry.lastmod}</lastmod>`);
      }
      if (entry.changefreq) {
        lines.push(`        <changefreq>${entry.changefreq}</changefreq>`);
      }
      if (typeof entry.priority === "number") {
        lines.push(`        <priority>${entry.priority.toFixed(1)}</priority>`);
      }

      lines.push(`    </url>`);
      return lines.join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
