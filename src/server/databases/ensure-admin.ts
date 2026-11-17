import { prisma } from "@/server/db";
import { parseDatabaseUrl } from "@/server/backup/pg-url";

const ADMIN_SLUG = "admin";

/**
 * Гарантирует запись «Админка Вайбик» из DATABASE_URL текущего процесса.
 * Dev-БД в прод не попадёт: в проде другой DATABASE_URL (хост postgres).
 * Пароль в Vault не дублируем.
 */
export async function ensureAdminConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const parts = parseDatabaseUrl(url);
  const existing = await prisma.dbConnection.findUnique({
    where: { slug: ADMIN_SLUG },
  });
  if (existing) {
    return prisma.dbConnection.update({
      where: { id: existing.id },
      data: {
        name: existing.name || "Админка Вайбик",
        host: parts.host,
        port: Number(parts.port),
        database: parts.database,
        engine: "postgres",
        isSystem: true,
        secretId: null,
      },
    });
  }
  return prisma.dbConnection.create({
    data: {
      slug: ADMIN_SLUG,
      name: "Админка Вайбик",
      engine: "postgres",
      host: parts.host,
      port: Number(parts.port),
      database: parts.database,
      isSystem: true,
      secretId: null,
      retention: 14,
      backupSchedule: "0 3 * * *",
    },
  });
}

export function slugifyConnectionName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "db";
  // ASCII-only slug for filesystem
  const ascii = base
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `db-${Date.now().toString(36)}`;
}
