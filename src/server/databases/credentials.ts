import type { DbConnection } from "@prisma/client";
import { parseDatabaseUrl } from "@/server/backup/pg-url";
import { prisma } from "@/server/db";
import { revealSecretPayload } from "@/server/vault/service";

export type DbCreds = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/**
 * Учётные данные для подключения.
 * isSystem → из DATABASE_URL процесса (пароль не дублируем в Vault).
 * иначе → Vault kind=db (username + password / secrets.password).
 */
export async function resolveCredentials(
  conn: DbConnection,
): Promise<DbCreds> {
  if (conn.isSystem) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL не задан");
    const p = parseDatabaseUrl(url);
    return {
      host: conn.host || p.host,
      port: conn.port || Number(p.port),
      user: p.user,
      password: p.password,
      database: conn.database || p.database,
    };
  }
  if (!conn.secretId) {
    throw Object.assign(new Error("Нет secretId для подключения"), {
      status: 400,
      code: "NO_SECRET",
    });
  }
  const secret = await prisma.secret.findUnique({ where: { id: conn.secretId } });
  if (!secret || secret.kind !== "db") {
    throw Object.assign(new Error("Запись Vault kind=db не найдена"), {
      status: 400,
      code: "NO_SECRET",
    });
  }
  const payload = revealSecretPayload(secret);
  const password = String(
    payload.password ?? payload.apiKey ?? payload.token ?? "",
  );
  const user = String(
    secret.username || payload.username || payload.user || "",
  );
  if (!user || !password) {
    throw Object.assign(
      new Error("В Vault нет username/password для БД"),
      { status: 400, code: "NO_SECRET" },
    );
  }
  return {
    host: conn.host,
    port: conn.port,
    user,
    password,
    database: conn.database,
  };
}
