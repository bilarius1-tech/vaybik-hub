import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireReauth } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

/** Скачивание только .enc после reauth */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("databases.read");
    await requireReauth();
    const { id } = await ctx.params;
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) return jsonError("NOT_FOUND", "Бэкап не найден", 404);
    if (!existsSync(backup.file)) {
      return jsonError("NOT_FOUND", "Файл на диске не найден", 404);
    }

    const st = await stat(backup.file);
    const fileName = path.basename(backup.file);

    await writeAudit({
      actorId: auth.user.id,
      action: "backups.download",
      entity: "Backup",
      entityId: id,
      diff: { fileName, sizeBytes: st.size },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    const buf = await readFile(backup.file);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(st.size),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
