import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { chatApiMissingKeys } from "@/server/chat/config";
import { connectServiceSchema } from "@/server/clients/schemas";
import { connectProduct } from "@/server/clients/service";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("clients.manage");
    const { id } = await ctx.params;
    const body = connectServiceSchema.parse(await req.json());

    // Без ручного externalId требуем env
    if (!body.externalId) {
      const missing = chatApiMissingKeys();
      if (missing.length > 0) {
        return jsonError(
          "CHAT_NOT_CONFIGURED",
          `Чат не настроен. Задайте в .env: ${missing.join(", ")}`,
          503,
        );
      }
    }

    const result = await connectProduct({
      clientId: id,
      serviceSlug: body.serviceSlug,
      externalIdManual: body.externalId,
      note: body.note,
    });

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "CHAT_UNAVAILABLE" ||
              result.code === "CHAT_NOT_CONFIGURED"
            ? 503
            : 400;
      return jsonError(result.code, result.message, status);
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "clients.connect",
      entity: "ClientService",
      entityId: result.clientService.id,
      diff: {
        clientId: id,
        serviceId: result.clientService.serviceId,
        serviceSlug: result.clientService.service.slug,
        status: result.clientService.status,
        hasExternalId: Boolean(result.clientService.externalId),
        syncError: result.clientService.lastSyncError,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ clientService: result.clientService }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
