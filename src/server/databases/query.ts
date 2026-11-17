import type { DbConnection } from "@prisma/client";
import {
  DEFAULT_ROW_LIMIT,
  withReadOnlyClient,
  type SafeQueryResult,
} from "@/server/databases/client";
import { resolveCredentials } from "@/server/databases/credentials";
import { assertReadOnlySelect } from "@/server/databases/sql-guard";

export async function runSelectQuery(
  conn: DbConnection,
  sql: string,
): Promise<SafeQueryResult> {
  const safeSql = assertReadOnlySelect(sql);
  const creds = await resolveCredentials(conn);
  return withReadOnlyClient(creds, async (client) => {
    // Лимит строк через обёртку, если пользователь не указал LIMIT
    const hasLimit = /\bLIMIT\b/i.test(safeSql);
    const wrapped = hasLimit
      ? safeSql
      : `SELECT * FROM (${safeSql}) AS _q LIMIT ${DEFAULT_ROW_LIMIT + 1}`;
    const res = await client.query(wrapped);
    const truncated = !hasLimit && res.rows.length > DEFAULT_ROW_LIMIT;
    const rows = truncated ? res.rows.slice(0, DEFAULT_ROW_LIMIT) : res.rows;
    return {
      columns: res.fields.map((f) => f.name),
      rows,
      rowCount: rows.length,
      truncated,
    };
  });
}
