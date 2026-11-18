import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import {
  clientServiceStatusSchema,
  setExternalIdSchema,
} from "@/server/clients/schemas";
import {
  setManualExternalId,
  updateClientServiceStatus,
} from "@/server/clients/service";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ csId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("clients.manage");
    const { csId } = await ctx.params;
    const raw = await req.json();

    if ("externalId" in raw && !("status" in raw)) {
      const body = setExternalIdSchema.parse(raw);
      const clientService = await setManualExternalId({
        clientServiceId: csId,
        externalId: body.externalId,
      });
      await writeAudit({
        actorId: auth.user.id,
        action: "clients.external_id",
        entity: "ClientService",
        entityId: csId,
        diff: { hasExternalId: true },
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      return jsonOk({ clientService });
    }

    const body = clientServiceStatusSchema.parse(raw);
    const result = await updateClientServiceStatus({
      clientServiceId: csId,
      status: body.status,
    });
    if (!result.ok) {
      return jsonError(result.code, result.message, 404);
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "clients.service_status",
      entity: "ClientService",
      entityId: csId,
      diff: {
        status: body.status,
        syncError: result.clientService.lastSyncError,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ clientService: result.clientService });
  } catch (err) {
    return handleRouteError(err);
  }
}
