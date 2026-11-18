import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import {
  clientServicePeriodSchema,
  clientServiceStatusSchema,
  setExternalIdSchema,
} from "@/server/clients/schemas";
import {
  setManualExternalId,
  updateClientServicePeriod,
  updateClientServiceStatus,
} from "@/server/clients/service";
import { dateToYmd } from "@/server/clients/period";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ csId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("clients.manage");
    const { csId } = await ctx.params;
    const raw = await req.json();

    if ("externalId" in raw && !("status" in raw) && !("activeUntil" in raw) && !("activeFrom" in raw) && !("paymentNote" in raw)) {
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

    if (
      "activeFrom" in raw ||
      "activeUntil" in raw ||
      "paymentNote" in raw
    ) {
      const body = clientServicePeriodSchema.parse(raw);
      const result = await updateClientServicePeriod({
        clientServiceId: csId,
        activeFrom: body.activeFrom,
        activeUntil: body.activeUntil,
        paymentNote: body.paymentNote,
      });
      if (!result.ok) {
        return jsonError(result.code, result.message, 404);
      }
      await writeAudit({
        actorId: auth.user.id,
        action: "clients.service_period",
        entity: "ClientService",
        entityId: csId,
        diff: {
          from: result.previous,
          to: {
            activeFrom: dateToYmd(result.clientService.activeFrom),
            activeUntil: dateToYmd(result.clientService.activeUntil),
            paymentNote: result.clientService.paymentNote,
          },
          syncError: result.clientService.lastSyncError,
        },
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      return jsonOk({ clientService: result.clientService });
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
