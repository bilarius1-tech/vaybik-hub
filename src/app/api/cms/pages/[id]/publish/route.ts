import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { publishSchema } from "@/server/cms/schemas";
import { publishPage } from "@/server/cms/service";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const body = publishSchema.parse(await req.json().catch(() => ({})));

    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Страница не найдена", 404);

    const { page, revision } = await publishPage(id, auth.user.id, body.note);

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.page.publish",
      entity: "Page",
      entityId: id,
      diff: { path: page.path, revisionId: revision.id },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ page, revision });
  } catch (err) {
    return handleRouteError(err);
  }
}
