import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireRole } from "@/server/auth/require";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { prisma } from "@/server/db";
import { removeMediaAssetDir } from "@/server/cms/media/store";

/** Очистить корзину — только OWNER */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    requireRole(auth.user, "OWNER");

    const trashed = await prisma.mediaAsset.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true },
    });
    for (const a of trashed) {
      await prisma.mediaAsset.delete({ where: { id: a.id } });
      await removeMediaAssetDir(a.id).catch(() => undefined);
    }
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.media.trash.empty",
      entity: "MediaAsset",
      diff: { count: trashed.length },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ deleted: trashed.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
