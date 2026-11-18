import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { retrySyncClientService } from "@/server/clients/service";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ csId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("clients.manage");
    const { csId } = await ctx.params;
    const result = await retrySyncClientService(csId);

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "CHAT_UNAVAILABLE" ||
              result.code === "CHAT_NOT_CONFIGURED"
            ? 503
            : 400;
      await writeAudit({
        actorId: auth.user.id,
        action: "clients.sync_failed",
        entity: "ClientService",
        entityId: csId,
        diff: { code: result.code },
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      return jsonError(result.code, result.message, status);
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "clients.sync",
      entity: "ClientService",
      entityId: csId,
      diff: { hasExternalId: Boolean(result.clientService.externalId) },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ clientService: result.clientService });
  } catch (err) {
    return handleRouteError(err);
  }
}
