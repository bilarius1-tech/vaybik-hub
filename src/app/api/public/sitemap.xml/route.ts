import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const pages = await prisma.seoPage.findMany({
    where: { inSitemap: true },
    orderBy: [{ host: "asc" }, { path: "asc" }],
  });

  const urls = pages
    .map((p) => {
      const loc = `https://${p.host}${p.path === "/" ? "" : p.path}`;
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>${escapeXml(p.changefreq)}</changefreq>
    <priority>${p.priority.toFixed(1)}</priority>
    <lastmod>${p.updatedAt.toISOString().slice(0, 10)}</lastmod>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
