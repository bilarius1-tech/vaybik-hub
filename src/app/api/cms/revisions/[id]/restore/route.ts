import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { restoreRevision } from "@/server/cms/service";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const page = await restoreRevision(id, auth.user.id);

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.revision.restore",
      entity: "PageRevision",
      entityId: id,
      diff: { pageId: page.id },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ page });
  } catch (err) {
    return handleRouteError(err);
  }
}
