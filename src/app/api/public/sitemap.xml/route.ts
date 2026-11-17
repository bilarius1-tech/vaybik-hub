import { prisma } from "@/server/db";
import { buildPublicCmsSitemapXml } from "@/server/seo/sitemap";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = await buildPublicCmsSitemapXml(prisma);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
