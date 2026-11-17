import type { DbConnection } from "@prisma/client";
import { prisma } from "@/server/db";
import { withReadOnlyClient } from "@/server/databases/client";
import { resolveCredentials } from "@/server/databases/credentials";

export type InspectResult = {
  version: string;
  sizeBytes: number;
  tableCount: number;
  tables: Array<{
    schema: string;
    name: string;
    approxRows: number | null;
    sizeBytes: number | null;
  }>;
};

export async function inspectConnection(
  conn: DbConnection,
): Promise<InspectResult> {
  const creds = await resolveCredentials(conn);
  const result = await withReadOnlyClient(creds, async (client) => {
    const ver = await client.query<{ v: string }>(
      "SELECT version() AS v",
    );
    const size = await client.query<{ s: string }>(
      "SELECT pg_database_size(current_database())::text AS s",
    );
    const tables = await client.query<{
      schema: string;
      name: string;
      approx_rows: string | null;
      size_bytes: string | null;
    }>(`
      SELECT
        n.nspname AS schema,
        c.relname AS name,
        c.reltuples::bigint::text AS approx_rows,
        pg_total_relation_size(c.oid)::text AS size_bytes
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY pg_total_relation_size(c.oid) DESC NULLS LAST, c.relname
      LIMIT 200
    `);
    return {
      version: String(ver.rows[0]?.v ?? "").split(",")[0] ?? "",
      sizeBytes: Number(size.rows[0]?.s ?? 0),
      tableCount: tables.rowCount ?? tables.rows.length,
      tables: tables.rows.map((r) => ({
        schema: r.schema,
        name: r.name,
        approxRows: r.approx_rows != null ? Number(r.approx_rows) : null,
        sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : null,
      })),
    };
  });

  await prisma.dbConnection.update({
    where: { id: conn.id },
    data: {
      lastSizeBytes: BigInt(result.sizeBytes),
      lastTableCount: result.tableCount,
      lastPgVersion: result.version.slice(0, 120),
      lastInspectedAt: new Date(),
    },
  });

  await prisma.dbSizeSnapshot.create({
    data: {
      dbConnectionId: conn.id,
      sizeBytes: BigInt(result.sizeBytes),
    },
  });

  return result;
}

export async function listTables(conn: DbConnection) {
  const inspected = await inspectConnection(conn);
  return inspected.tables;
}
