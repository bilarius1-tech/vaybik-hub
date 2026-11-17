import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { listTables } from "@/server/databases/inspect";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("databases.read");
    const { id } = await ctx.params;
    const connection = await prisma.dbConnection.findUnique({ where: { id } });
    if (!connection) return jsonError("NOT_FOUND", "Подключение не найдено", 404);
    const tables = await listTables(connection);
    return jsonOk({ tables });
  } catch (err) {
    return handleRouteError(err);
  }
}
