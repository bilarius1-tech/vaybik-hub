import { prisma } from "@/server/db";

/**
 * Агрегирует HealthCheck старше 7 дней по часам:
 * оставляет одну запись на час (среднее responseMs, худший статус).
 */
export async function aggregateOldHealthChecks(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const old = await prisma.healthCheck.findMany({
    where: { checkedAt: { lt: cutoff } },
    orderBy: { checkedAt: "asc" },
  });
  if (old.length === 0) return 0;

  type Bucket = {
    serviceId: string;
    hour: string;
    statuses: string[];
    responseMs: number[];
    httpStatus: number | null;
    error: string | null;
    checkedAt: Date;
  };

  const buckets = new Map<string, Bucket>();
  for (const row of old) {
    const hour = new Date(row.checkedAt);
    hour.setMinutes(0, 0, 0);
    const key = `${row.serviceId}:${hour.toISOString()}`;
    const b = buckets.get(key) || {
      serviceId: row.serviceId,
      hour: hour.toISOString(),
      statuses: [] as string[],
      responseMs: [] as number[],
      httpStatus: row.httpStatus,
      error: row.error,
      checkedAt: hour,
    };
    b.statuses.push(row.status);
    if (row.responseMs != null) b.responseMs.push(row.responseMs);
    buckets.set(key, b);
  }

  const ids = old.map((r) => r.id);
  await prisma.healthCheck.deleteMany({ where: { id: { in: ids } } });

  const rank: Record<string, number> = {
    DOWN: 3,
    DEGRADED: 2,
    UNKNOWN: 1,
    UP: 0,
  };

  for (const b of buckets.values()) {
    const status = b.statuses.sort(
      (a, c) => (rank[c] || 0) - (rank[a] || 0),
    )[0] as "UP" | "DOWN" | "DEGRADED" | "UNKNOWN";
    const avg =
      b.responseMs.length > 0
        ? Math.round(b.responseMs.reduce((a, c) => a + c, 0) / b.responseMs.length)
        : null;
    await prisma.healthCheck.create({
      data: {
        serviceId: b.serviceId,
        status,
        httpStatus: b.httpStatus,
        responseMs: avg,
        error: b.error,
        checkedAt: b.checkedAt,
      },
    });
  }

  return old.length;
}

/** Удаляет ServerMetric старше 14 дней */
export async function pruneOldServerMetrics(): Promise<number> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const res = await prisma.serverMetric.deleteMany({
    where: { takenAt: { lt: cutoff } },
  });
  return res.count;
}
