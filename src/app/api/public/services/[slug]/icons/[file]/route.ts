import { prisma } from "@/server/db";
import { SEO_PUBLIC_DENY_SLUGS } from "@/server/services/seo-defaults";
import { readServiceFaviconFile } from "@/server/services/seo-favicon";

type Ctx = { params: Promise<{ slug: string; file: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug, file } = await ctx.params;
  if (SEO_PUBLIC_DENY_SLUGS.has(slug)) {
    return new Response("Not Found", { status: 404 });
  }
  const service = await prisma.service.findUnique({
    where: { slug },
    select: { id: true, seo: { select: { faviconGeneratedAt: true } } },
  });
  if (!service?.seo?.faviconGeneratedAt) {
    return new Response("Not Found", { status: 404 });
  }
  const found = await readServiceFaviconFile(service.id, file);
  if (!found) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(new Uint8Array(found.buf), {
    status: 200,
    headers: {
      "Content-Type": found.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
    },
  });
}
