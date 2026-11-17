import { PrismaClient } from "@prisma/client";

/**
 * Prisma для site-процесса.
 * SITE_DATABASE_URL (роль только-чтение) — если задан, иначе DATABASE_URL.
 */
const url = process.env.SITE_DATABASE_URL || process.env.DATABASE_URL;

export const sitePrisma = new PrismaClient({
  datasources: url ? { db: { url } } : undefined,
  log: ["error"],
});
