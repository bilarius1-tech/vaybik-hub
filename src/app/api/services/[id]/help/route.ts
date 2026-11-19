import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import {
  fetchStudioHelpFromChat,
  serviceSupportsStudioHelp,
} from "@/server/chat/help-client";
import { prisma } from "@/server/db";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /admin/api/services/[id]/help
 * OWNER/ADMIN (services.manage). Секрет чата на сервере; клиенту только HTML.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("services.manage");
    const { id } = await ctx.params;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) return jsonError("NOT_FOUND", "Сервис не найден", 404);
    if (!serviceSupportsStudioHelp(service)) {
      return jsonError(
        "HELP_NOT_SUPPORTED",
        "У этого сервиса нет студийной справки",
        404,
      );
    }

    const result = await fetchStudioHelpFromChat();
    if (!result.ok) {
      return jsonError("HELP_UNAVAILABLE", "Справка недоступна", 503);
    }

    return jsonOk({
      service: { id: service.id, slug: service.slug, name: service.name },
      pages: result.pages,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
