import { Client, type QueryResultRow } from "pg";
import type { DbCreds } from "@/server/databases/credentials";
import { redactSecrets } from "@/server/backup/pg-url";

const STATEMENT_TIMEOUT_MS = 5_000;
const DEFAULT_ROW_LIMIT = 500;

export { STATEMENT_TIMEOUT_MS, DEFAULT_ROW_LIMIT };

export function createDbClient(creds: DbCreds): Client {
  return new Client({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
    database: creds.database,
    connectionTimeoutMillis: 5_000,
    query_timeout: STATEMENT_TIMEOUT_MS + 1_000,
    application_name: "vaybik-hub-readonly",
  });
}

export async function withReadOnlyClient<T>(
  creds: DbCreds,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = createDbClient(creds);
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT_MS}'`);
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10000'");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw wrapDbError(err, creds.database);
    }
  } catch (err) {
    throw wrapDbError(err, creds.database);
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

export function wrapDbError(err: unknown, database?: string): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  const cleaned = redactSecrets(msg).slice(0, 400);
  const isTimeout =
    code === "57014" || /statement timeout|Query read timeout/i.test(msg);
  if (isTimeout) {
    return Object.assign(
      new Error(
        `Таймаут запроса (>${STATEMENT_TIMEOUT_MS / 1000} с)${database ? ` БД=${database}` : ""}`,
      ),
      { status: 408, code: "QUERY_TIMEOUT" },
    );
  }
  return Object.assign(
    new Error(
      `Ошибка БД${database ? `=${database}` : ""}${code ? ` code=${code}` : ""}: ${cleaned}`,
    ),
    { status: 502, code: "DB_ERROR" },
  );
}

export type SafeQueryResult = {
  columns: string[];
  rows: QueryResultRow[];
  rowCount: number;
  truncated: boolean;
};
