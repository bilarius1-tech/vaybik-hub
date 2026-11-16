import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { inspectPage } from "@/server/seo/inspect";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const body = z.object({ url: z.string().url() }).parse(await req.json());
    const result = await inspectPage(body.url);
    await writeAudit({
      actorId: ctx.user.id,
      action: "seo.inspect",
      entity: "SeoPage",
      diff: { url: body.url, errors: result.errors.length },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ result });
  } catch (err) {
    return handleRouteError(err);
  }
}
