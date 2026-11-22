import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import {
  getServiceSeoForAdmin,
  updateServiceSeo,
} from "@/server/services/seo";
import {
  parseJsonLdField,
  serviceSeoUpdateSchema,
} from "@/server/services/seo-schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("services.manage");
    const { id } = await ctx.params;
    const row = await getServiceSeoForAdmin(prisma, id);
    if (!row) return jsonError("NOT_FOUND", "Сервис не найден", 404);
    return jsonOk({ service: row.service, seo: row.seo });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("services.manage");
    const { id } = await ctx.params;
    const raw = await req.json();
    if (raw && typeof raw === "object" && "jsonLd" in raw) {
      try {
        (raw as { jsonLd: unknown }).jsonLd = parseJsonLdField(
          (raw as { jsonLd: unknown }).jsonLd,
        );
      } catch {
        return jsonError("VALIDATION", "jsonLd: невалидный JSON", 400);
      }
    }
    const body = serviceSeoUpdateSchema.parse(raw);
    const seo = await updateServiceSeo(prisma, id, body, auth.user.id);
    await writeAudit({
      actorId: auth.user.id,
      action: "service.seo_update",
      entity: "ServiceSeo",
      entityId: seo.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
      diff: { serviceId: id, fields: Object.keys(body) },
    });
    return jsonOk({ seo });
  } catch (err) {
    return handleRouteError(err);
  }
}
