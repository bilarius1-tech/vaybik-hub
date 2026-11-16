import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { checkService } from "@/server/services/check-runner";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("services.manage");
    const { id } = await ctx.params;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) return jsonError("NOT_FOUND", "Сервис не найден", 404);
    if (!service.healthUrl) {
      return jsonError("NO_HEALTH", "Не задан healthUrl", 400);
    }

    await checkService(service);
    const updated = await prisma.service.findUnique({ where: { id } });

    await writeAudit({
      actorId: auth.user.id,
      action: "services.check",
      entity: "Service",
      entityId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ service: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
