import type { PrismaClient } from "@prisma/client";
import { listPublicPathsForSitemap } from "@/server/cms/public/load";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type SitemapEntry = {
  host: string;
  path: string;
  priority: number;
  changefreq: string;
  lastmod: Date;
};

/** Sitemap только публичных CMS-страниц с SeoPage.inSitemap */
export async function buildPublicCmsSitemapXml(
  db: PrismaClient,
): Promise<string> {
  const pages = await listPublicPathsForSitemap(db);
  return buildSitemapXml(pages);
}

export function buildSitemapXml(pages: SitemapEntry[]): string {
  const urls = pages
    .map((p) => {
      const loc = `https://${p.host}${p.path === "/" ? "" : p.path}`;
      const lastmod = p.lastmod.toISOString().slice(0, 10);
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(p.changefreq)}</changefreq>
    <priority>${p.priority.toFixed(1)}</priority>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
