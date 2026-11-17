import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import {
  assertConnectionNotBlocked,
  restoreTargetOptions,
} from "@/server/databases/policy";
import { dbConnectionCreateSchema } from "@/server/databases/schemas";
import {
  ensureAdminConnection,
  slugifyConnectionName,
} from "@/server/databases/ensure-admin";

function serializeConn<T extends { lastSizeBytes: bigint | null }>(c: T) {
  return {
    ...c,
    lastSizeBytes:
      c.lastSizeBytes != null ? c.lastSizeBytes.toString() : null,
  };
}

export async function GET() {
  try {
    await requireCan("databases.read");
    await ensureAdminConnection();
    const connections = await prisma.dbConnection.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        backups: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            sizeBytes: true,
            error: true,
          },
        },
        sizeSnapshots: {
          orderBy: { takenAt: "desc" },
          take: 30,
          select: { sizeBytes: true, takenAt: true },
        },
      },
    });
    return jsonOk({
      connections: connections.map((c) => ({
        ...serializeConn(c),
        backups: c.backups.map((b) => ({
          ...b,
          sizeBytes: b.sizeBytes != null ? b.sizeBytes.toString() : null,
        })),
        sizeSnapshots: c.sizeSnapshots
          .map((s) => ({
            sizeBytes: s.sizeBytes.toString(),
            takenAt: s.takenAt,
          }))
          .reverse(),
      })),
      restoreTargets: restoreTargetOptions(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("databases.read");
    const body = dbConnectionCreateSchema.parse(await req.json());
    assertConnectionNotBlocked({
      host: body.host,
      name: body.name,
      slug: body.name,
      database: body.database,
    });

    const secret = await prisma.secret.findUnique({ where: { id: body.secretId } });
    if (!secret || secret.kind !== "db") {
      return jsonError("NO_SECRET", "Нужна запись Vault с kind=db", 400);
    }

    let slug = slugifyConnectionName(body.name);
    const clash = await prisma.dbConnection.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const connection = await prisma.dbConnection.create({
      data: {
        slug,
        name: body.name,
        engine: body.engine,
        host: body.host,
        port: body.port,
        database: body.database,
        secretId: body.secretId,
        backupSchedule: body.backupSchedule ?? null,
        retention: body.retention,
        isSystem: false,
        externalStorage: { enabled: false },
      },
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: "databases.create",
      entity: "DbConnection",
      entityId: connection.id,
      diff: {
        slug: connection.slug,
        name: connection.name,
        host: connection.host,
        database: connection.database,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ connection: serializeConn(connection) }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
