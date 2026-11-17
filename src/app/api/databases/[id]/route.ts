import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { assertConnectionNotBlocked } from "@/server/databases/policy";
import { dbConnectionUpdateSchema } from "@/server/databases/schemas";
import { inspectConnection } from "@/server/databases/inspect";

type Ctx = { params: Promise<{ id: string }> };

function serializeConn<T extends { lastSizeBytes: bigint | null }>(c: T) {
  return {
    ...c,
    lastSizeBytes:
      c.lastSizeBytes != null ? c.lastSizeBytes.toString() : null,
  };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("databases.read");
    const { id } = await ctx.params;
    const connection = await prisma.dbConnection.findUnique({
      where: { id },
      include: {
        backups: { orderBy: { startedAt: "desc" }, take: 20 },
        sizeSnapshots: { orderBy: { takenAt: "desc" }, take: 60 },
      },
    });
    if (!connection) return jsonError("NOT_FOUND", "Подключение не найдено", 404);

    let inspect = null;
    try {
      inspect = await inspectConnection(connection);
    } catch (err) {
      inspect = {
        error: err instanceof Error ? err.message : "inspect failed",
      };
    }

    const fresh = await prisma.dbConnection.findUniqueOrThrow({ where: { id } });
    return jsonOk({
      connection: {
        ...serializeConn(fresh),
        backups: connection.backups.map((b) => ({
          ...b,
          sizeBytes: b.sizeBytes != null ? b.sizeBytes.toString() : null,
        })),
        sizeSnapshots: connection.sizeSnapshots
          .map((s) => ({
            sizeBytes: s.sizeBytes.toString(),
            takenAt: s.takenAt,
          }))
          .reverse(),
      },
      inspect,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("databases.read");
    const { id } = await ctx.params;
    const existing = await prisma.dbConnection.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Подключение не найдено", 404);
    if (existing.isSystem) {
      return jsonError("FORBIDDEN", "Системное подключение нельзя менять так", 403);
    }
    const body = dbConnectionUpdateSchema.parse(await req.json());
    if (body.host || body.name || body.database) {
      assertConnectionNotBlocked({
        host: body.host ?? existing.host,
        name: body.name ?? existing.name,
        slug: existing.slug,
        database: body.database ?? existing.database,
      });
    }
    const connection = await prisma.dbConnection.update({
      where: { id },
      data: {
        name: body.name,
        host: body.host,
        port: body.port,
        database: body.database,
        secretId: body.secretId,
        backupSchedule: body.backupSchedule,
        retention: body.retention,
      },
    });
    await writeAudit({
      actorId: auth.user.id,
      action: "databases.update",
      entity: "DbConnection",
      entityId: id,
      diff: { name: connection.name, host: connection.host },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ connection: serializeConn(connection) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("databases.read");
    const { id } = await ctx.params;
    const existing = await prisma.dbConnection.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Подключение не найдено", 404);
    if (existing.isSystem) {
      return jsonError("FORBIDDEN", "Системное подключение нельзя удалить", 403);
    }
    await prisma.dbConnection.delete({ where: { id } });
    await writeAudit({
      actorId: auth.user.id,
      action: "databases.delete",
      entity: "DbConnection",
      entityId: id,
      diff: { slug: existing.slug, name: existing.name },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
