/**
 * Разбор DATABASE_URL для pg_dump/pg_restore без query-параметров Prisma
 * (`?schema=public` и т.п. ломают клиент). В ошибках — без URI и пароля.
 */

export type PgConnParts = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

export function parseDatabaseUrl(url: string): PgConnParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL: неверный формат");
  }
  const proto = parsed.protocol.replace(/:$/, "");
  if (proto !== "postgresql" && proto !== "postgres") {
    throw new Error("DATABASE_URL: ожидается postgresql");
  }
  const database = decodeURIComponent(
    parsed.pathname.replace(/^\//, "").split("/")[0] || "",
  );
  if (!database) throw new Error("DATABASE_URL: нет имени БД");
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port || "5432",
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    database,
  };
}

/** Env для libpq / pg_dump — без передачи URI в argv */
export function pgEnvFromUrl(url: string): Record<string, string> {
  const c = parseDatabaseUrl(url);
  return {
    PGHOST: c.host,
    PGPORT: c.port,
    PGUSER: c.user,
    PGPASSWORD: c.password,
    PGDATABASE: c.database,
  };
}

/** Убрать URI/пароль из текста ошибки (на случай утечки из stderr) */
export function redactSecrets(text: string): string {
  return text
    .replace(/postgresql:\/\/[^\s'"\\]+/gi, "[redacted-uri]")
    .replace(/postgres:\/\/[^\s'"\\]+/gi, "[redacted-uri]")
    .replace(/PGPASSWORD=\S+/gi, "PGPASSWORD=[redacted]")
    .replace(/(password\s*[=:]\s*)\S+/gi, "$1[redacted]");
}

export function sanitizePgError(
  err: unknown,
  opts?: { database?: string; tool?: string },
): Error {
  const tool = opts?.tool ?? "pg_dump";
  const raw =
    err && typeof err === "object" && "stderr" in err
      ? String((err as { stderr?: unknown }).stderr || "")
      : "";
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  const cleaned = redactSecrets(`${msg} ${raw}`.trim()).slice(0, 400);
  const dbPart = opts?.database ? ` БД=${opts.database}` : "";
  const codePart = code ? ` code=${code}` : "";
  return new Error(`${tool} failed${dbPart}${codePart}: ${cleaned}`);
}

/** URI без query (для инструментов, которым нужен connection string) */
export function connectionUriWithoutQuery(url: string): string {
  const c = parseDatabaseUrl(url);
  const user = encodeURIComponent(c.user);
  const pass = encodeURIComponent(c.password);
  const auth = c.password ? `${user}:${pass}` : user;
  return `postgresql://${auth}@${c.host}:${c.port}/${encodeURIComponent(c.database)}`;
}
