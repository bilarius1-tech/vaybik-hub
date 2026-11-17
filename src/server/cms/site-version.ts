import type { Prisma, PrismaClient } from "@prisma/client";

export const SITE_CONTENT_VERSION_KEY = "site.contentVersion";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Повышает Setting site.contentVersion (число).
 * Site-сервер опрашивает раз в 5 с и сбрасывает кеш.
 */
export async function bumpSiteVersion(
  tx: Tx,
  reason: string,
): Promise<number> {
  const row = await tx.setting.findUnique({
    where: { key: SITE_CONTENT_VERSION_KEY },
  });
  const current =
    typeof row?.value === "number"
      ? row.value
      : typeof row?.value === "object" &&
          row.value &&
          "n" in (row.value as object)
        ? Number((row.value as { n: number }).n)
        : Number(row?.value) || 0;
  const next = (Number.isFinite(current) ? current : 0) + 1;
  await tx.setting.upsert({
    where: { key: SITE_CONTENT_VERSION_KEY },
    create: {
      key: SITE_CONTENT_VERSION_KEY,
      value: next,
      updatedBy: reason.slice(0, 120),
    },
    update: {
      value: next,
      updatedBy: reason.slice(0, 120),
    },
  });
  return next;
}

export async function getSiteContentVersion(tx: Tx): Promise<number> {
  const row = await tx.setting.findUnique({
    where: { key: SITE_CONTENT_VERSION_KEY },
  });
  if (!row) return 0;
  if (typeof row.value === "number") return row.value;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : 0;
}
