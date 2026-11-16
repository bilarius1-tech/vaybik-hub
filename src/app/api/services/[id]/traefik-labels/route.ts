import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { traefikLabelsSchema } from "@/server/services/schemas";
import { generateTraefikComposeSnippet } from "@/server/services/traefik-labels";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("services.manage");
    const { id } = await ctx.params;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) return jsonError("NOT_FOUND", "Сервис не найден", 404);

    const sp = req.nextUrl.searchParams;
    const parsed = traefikLabelsSchema.safeParse({
      subdomain: sp.get("subdomain") || new URL(service.url).hostname,
      port: Number(sp.get("port") || 3000),
      network: sp.get("network") || undefined,
      certresolver: sp.get("certresolver") || undefined,
    });
    if (!parsed.success) {
      return jsonError("VALIDATION", "Некорректные параметры", 400);
    }

    const yaml = generateTraefikComposeSnippet({
      slug: service.slug,
      subdomain: parsed.data.subdomain,
      port: parsed.data.port,
      network: parsed.data.network,
      certresolver: parsed.data.certresolver,
    });

    return jsonOk({ yaml });
  } catch (err) {
    return handleRouteError(err);
  }
}
