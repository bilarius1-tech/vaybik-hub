import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { bulkPages } from "@/server/cms/pages-list";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { z } from "zod";

const bulkSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(100),
  action: z.enum(["publish", "unpublish", "trash", "restore", "purge"]),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const body = bulkSchema.parse(await req.json());
    const result = await bulkPages(body.ids, body.action, auth.user.id, {
      isOwner: auth.user.role === "OWNER",
    });
    await writeAudit({
      actorId: auth.user.id,
      action: `cms.page.bulk.${body.action}`,
      entity: "Page",
      entityId: null,
      diff: {
        action: body.action,
        ok: result.ok,
        failed: result.failed,
        ids: body.ids,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
