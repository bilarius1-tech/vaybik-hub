import { prisma } from "@/server/db";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { buildPublicServiceSeo } from "@/server/services/seo";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const payload = await buildPublicServiceSeo(prisma, slug);
    if (!payload) {
      return jsonError("NOT_FOUND", "Сервис не найден", 404);
    }
    return jsonOk(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
