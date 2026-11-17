import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import {
  MediaError,
  MEDIA_MAX_BYTES,
  replaceMediaAsset,
} from "@/server/cms/media/store";
import { bumpSiteVersion } from "@/server/cms/site-version";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("VALIDATION", "Нужен файл в поле file", 400);
    }
    if (file.size > MEDIA_MAX_BYTES) {
      return jsonError("TOO_LARGE", "Файл больше 10 МБ", 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const asset = await replaceMediaAsset(id, buf, file.name || "replace");
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.media.replace",
      entity: "MediaAsset",
      entityId: id,
      diff: {
        version: asset.version,
        mime: asset.mime,
        size: asset.size,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    await bumpSiteVersion(prisma, "cms.media.replace");
    return jsonOk({ asset });
  } catch (err) {
    if (err instanceof MediaError) {
      return jsonError(err.code, err.message, err.status, err.extra);
    }
    return handleRouteError(err);
  }
}
