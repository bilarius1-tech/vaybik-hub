import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { fetchTableRows, fetchTableSchema } from "@/server/databases/browse";
import { tableRowsQuerySchema } from "@/server/databases/schemas";

type Ctx = { params: Promise<{ id: string; t: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("databases.read");
    const { id, t } = await ctx.params;
    const connection = await prisma.dbConnection.findUnique({ where: { id } });
    if (!connection) return jsonError("NOT_FOUND", "Подключение не найдено", 404);

    const tableName = decodeURIComponent(t);
    const schema =
      req.nextUrl.searchParams.get("schema") ||
      (tableName.includes(".") ? tableName.split(".")[0]! : "public");
    const name = tableName.includes(".")
      ? tableName.slice(tableName.indexOf(".") + 1)
      : tableName;

    const q = tableRowsQuerySchema.parse({
      page: req.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: req.nextUrl.searchParams.get("pageSize") ?? undefined,
      filter: req.nextUrl.searchParams.get("filter") ?? undefined,
    });

    const [columnMeta, data] = await Promise.all([
      fetchTableSchema(connection, schema, name),
      fetchTableRows(connection, schema, name, q),
    ]);

    return jsonOk({
      schema,
      table: name,
      columnMeta,
      columns: data.columns,
      rows: data.rows,
      rowCount: data.rowCount,
      truncated: data.truncated,
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
