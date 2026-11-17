import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireRoleAuth } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { runSelectQuery } from "@/server/databases/query";
import { selectQuerySchema } from "@/server/databases/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    await requireCan("databases.read");
    const auth = await requireRoleAuth("OWNER");
    const { id } = await ctx.params;
    const connection = await prisma.dbConnection.findUnique({ where: { id } });
    if (!connection) return jsonError("NOT_FOUND", "Подключение не найдено", 404);

    const body = selectQuerySchema.parse(await req.json());
    const result = await runSelectQuery(connection, body.sql);

    await writeAudit({
      actorId: auth.user.id,
      action: "databases.query",
      entity: "DbConnection",
      entityId: id,
      diff: { sqlPreview: body.sql.slice(0, 120), rows: result.rowCount },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
