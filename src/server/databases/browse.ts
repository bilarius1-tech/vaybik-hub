import type { DbConnection } from "@prisma/client";
import {
  DEFAULT_ROW_LIMIT,
  withReadOnlyClient,
  type SafeQueryResult,
} from "@/server/databases/client";
import { resolveCredentials } from "@/server/databases/credentials";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function quoteIdent(name: string): string {
  if (!IDENT.test(name)) {
    throw Object.assign(new Error("Недопустимое имя таблицы/схемы"), {
      status: 400,
      code: "BAD_IDENT",
    });
  }
  return `"${name}"`;
}

export async function fetchTableRows(
  conn: DbConnection,
  schema: string,
  table: string,
  opts: { page: number; pageSize: number; filter?: string },
): Promise<SafeQueryResult & { total: number; page: number; pageSize: number }> {
  const pageSize = Math.min(opts.pageSize, DEFAULT_ROW_LIMIT);
  const page = Math.max(1, opts.page);
  const offset = (page - 1) * pageSize;
  const creds = await resolveCredentials(conn);
  const fq = `${quoteIdent(schema)}.${quoteIdent(table)}`;

  return withReadOnlyClient(creds, async (client) => {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'`,
      [schema, table],
    );
    if (!exists.rowCount) {
      throw Object.assign(new Error("Таблица не найдена"), {
        status: 404,
        code: "NOT_FOUND",
      });
    }

    const cols = await client.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table],
    );

    const textCols = cols.rows
      .filter((c) => /char|text|uuid|json|name/i.test(c.data_type))
      .map((c) => c.column_name);

    const filter = opts.filter?.trim();
    const useFilter = Boolean(filter && textCols.length > 0);
    const where = useFilter
      ? ` WHERE (${textCols.map((c) => `${quoteIdent(c)}::text ILIKE $1`).join(" OR ")})`
      : "";

    const countParams = useFilter ? [`%${filter}%`] : [];
    const countRes = await client.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM ${fq}${where}`,
      countParams,
    );
    const total = Number(countRes.rows[0]?.c ?? 0);

    const limitParam = useFilter ? 2 : 1;
    const offsetParam = limitParam + 1;
    const dataParams = useFilter
      ? [`%${filter}%`, pageSize, offset]
      : [pageSize, offset];

    const data = await client.query(
      `SELECT * FROM ${fq}${where} LIMIT $${limitParam} OFFSET $${offsetParam}`,
      dataParams,
    );

    return {
      columns: data.fields.map((f) => f.name),
      rows: data.rows,
      rowCount: data.rowCount ?? data.rows.length,
      truncated: false,
      total,
      page,
      pageSize,
    };
  });
}

export async function fetchTableSchema(
  conn: DbConnection,
  schema: string,
  table: string,
) {
  const creds = await resolveCredentials(conn);
  return withReadOnlyClient(creds, async (client) => {
    const cols = await client.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table],
    );
    return cols.rows.map((c) => ({
      name: c.column_name,
      type: c.data_type,
      nullable: c.is_nullable === "YES",
      default: c.column_default,
    }));
  });
}
