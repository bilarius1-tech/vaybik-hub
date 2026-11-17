import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { unpublishPage } from "@/server/cms/pages-list";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const page = await unpublishPage(id, auth.user.id);
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.page.unpublish",
      entity: "Page",
      entityId: id,
      diff: { path: page.path },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ page });
  } catch (err) {
    return handleRouteError(err);
  }
}
