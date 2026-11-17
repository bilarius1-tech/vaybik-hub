import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { runConnectionBackup } from "@/server/backup/connection-dump";
import { runAdminBackup } from "@/server/backup/run";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("databases.read");
    const { id } = await ctx.params;
    const connection = await prisma.dbConnection.findUnique({ where: { id } });
    if (!connection) return jsonError("NOT_FOUND", "Подключение не найдено", 404);

    let result: { backupId?: string; file: string; sizeBytes?: number };
    if (connection.isSystem) {
      // Админка: полный цикл (БД + uploads) + запись Backup для дампа БД
      const r = await runAdminBackup();
      const row = await prisma.backup.create({
        data: {
          dbConnectionId: connection.id,
          target: "admin-db",
          trigger: "manual",
          file: r.dbFile,
          status: "ok",
          sizeBytes: BigInt(r.dbBytes),
          createdById: auth.user.id,
          finishedAt: new Date(),
        },
      });
      // uploads отдельной строкой
      await prisma.backup.create({
        data: {
          dbConnectionId: connection.id,
          target: "uploads",
          trigger: "manual",
          file: r.uploadsFile,
          status: "ok",
          createdById: auth.user.id,
          finishedAt: new Date(),
        },
      });
      result = { backupId: row.id, file: r.dbFile, sizeBytes: r.dbBytes };
    } else {
      const r = await runConnectionBackup({
        connection,
        trigger: "manual",
        createdById: auth.user.id,
      });
      result = r;
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "databases.backup",
      entity: "DbConnection",
      entityId: id,
      diff: {
        file: result.file.split("/").pop(),
        backupId: result.backupId,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({
      ok: true,
      backupId: result.backupId,
      file: result.file.split("/").pop(),
      sizeBytes: result.sizeBytes,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
