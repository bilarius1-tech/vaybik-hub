import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireReauth } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { restoreBodySchema } from "@/server/databases/schemas";
import { runTestRestore } from "@/server/backup/restore-test";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    await requireCan("databases.restore");
    const auth = await requireReauth();
    const { id } = await ctx.params;
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) return jsonError("NOT_FOUND", "Бэкап не найден", 404);
    if (!backup.dbConnectionId) {
      return jsonError("BAD_TARGET", "У бэкапа нет подключения", 400);
    }
    const connection = await prisma.dbConnection.findUnique({
      where: { id: backup.dbConnectionId },
    });
    if (!connection) {
      return jsonError("NOT_FOUND", "Подключение не найдено", 404);
    }

    const body = restoreBodySchema.parse(await req.json());
    const result = await runTestRestore({
      backup,
      connection,
      confirmName: body.confirmName,
      actorId: auth.user.id,
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "backups.restore_test",
      entity: "Backup",
      entityId: id,
      diff: {
        container: result.containerName,
        detail: result.detail,
        target: "test",
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
