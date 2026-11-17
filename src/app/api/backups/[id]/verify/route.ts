import { existsSync } from "node:fs";
import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { verifyCustomDumpEnc } from "@/server/backup/connection-dump";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("databases.read");
    const { id } = await ctx.params;
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) return jsonError("NOT_FOUND", "Бэкап не найден", 404);
    if (!existsSync(backup.file)) {
      return jsonError("NOT_FOUND", "Файл не найден", 404);
    }
    if (!backup.file.includes(".dump.enc")) {
      return jsonError("BAD_FORMAT", "Проверка -l только для .dump.enc", 400);
    }

    await verifyCustomDumpEnc(backup.file);
    await prisma.backup.update({
      where: { id },
      data: { status: "verified", finishedAt: new Date() },
    });
    await writeAudit({
      actorId: auth.user.id,
      action: "backups.verify",
      entity: "Backup",
      entityId: id,
      diff: { fileName: backup.file.split("/").pop() },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
