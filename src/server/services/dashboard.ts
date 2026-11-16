import { prisma } from "@/server/db";

export type Period = "day" | "week" | "month";

export function periodSince(period: Period): Date {
  const now = Date.now();
  const ms =
    period === "day"
      ? 24 * 60 * 60 * 1000
      : period === "week"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return new Date(now - ms);
}

export async function getDashboardSummary(period: Period = "week") {
  const since = periodSince(period);
  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const deployed = services.filter((s) => s.isDeployed);
  const online = deployed.filter((s) => s.status === "UP").length;

  const latestMetric = await prisma.serverMetric.findFirst({
    orderBy: { takenAt: "desc" },
  });

  const metrics = await prisma.serverMetric.findMany({
    where: { takenAt: { gte: since } },
    orderBy: { takenAt: "asc" },
    take: 500,
  });

  let nearestCertDays: number | null = null;
  for (const s of services) {
    if (!s.certExpiresAt) continue;
    const days = Math.ceil(
      (s.certExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    if (nearestCertDays === null || days < nearestCertDays) nearestCertDays = days;
  }

  const alerts: { tone: "warn" | "bad"; title: string; body: string }[] = [];
  for (const s of deployed) {
    if (s.status === "DOWN") {
      alerts.push({
        tone: "bad",
        title: "Сервис упал",
        body: `${s.name} (${s.url}) не отвечает`,
      });
    }
    if (s.certExpiresAt) {
      const days = Math.ceil(
        (s.certExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      if (days < 14) {
        alerts.push({
          tone: "warn",
          title: "Сертификат истекает",
          body: `${s.name}: ~${days} дн.`,
        });
      }
    }
  }
  if (latestMetric && latestMetric.diskTotal > BigInt(0)) {
    const pct = Number((latestMetric.diskUsed * BigInt(100)) / latestMetric.diskTotal);
    if (pct > 80) {
      alerts.push({
        tone: "warn",
        title: "Диск заполнен",
        body: `${pct}% занято`,
      });
    }
  }

  const failedLogins = await prisma.auditLog.count({
    where: {
      action: "auth.login_failed",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (failedLogins >= 5) {
    alerts.push({
      tone: "warn",
      title: "Неуспешные входы",
      body: `${failedLogins} за 24 часа`,
    });
  }

  // Sparklines / uptime per service
  const serviceRows = await Promise.all(
    services.map(async (s) => {
      const checks = await prisma.healthCheck.findMany({
        where: {
          serviceId: s.id,
          checkedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { checkedAt: "asc" },
        take: 48,
      });
      const up = checks.filter((c) => c.status === "UP" || c.status === "DEGRADED").length;
      const uptime24 = checks.length ? Math.round((up / checks.length) * 1000) / 10 : null;
      const spark = checks
        .map((c) => c.responseMs)
        .filter((v): v is number => v != null);

      const weekChecks = await prisma.healthCheck.count({
        where: {
          serviceId: s.id,
          checkedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });
      const weekUp = await prisma.healthCheck.count({
        where: {
          serviceId: s.id,
          checkedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          status: { in: ["UP", "DEGRADED"] },
        },
      });
      const uptime7d = weekChecks
        ? Math.round((weekUp / weekChecks) * 1000) / 10
        : null;

      return {
        ...s,
        uptime24,
        uptime7d,
        spark,
      };
    }),
  );

  // Response time series (avg per hour for deployed with checks)
  const responseSeries: { label: string; data: { t: string; ms: number }[] }[] =
    [];
  for (const s of deployed.slice(0, 5)) {
    const checks = await prisma.healthCheck.findMany({
      where: { serviceId: s.id, checkedAt: { gte: since }, responseMs: { not: null } },
      orderBy: { checkedAt: "asc" },
      take: 200,
    });
    responseSeries.push({
      label: s.name,
      data: checks.map((c) => ({
        t: c.checkedAt.toISOString(),
        ms: c.responseMs!,
      })),
    });
  }

  const memPct =
    latestMetric && latestMetric.memTotal > BigInt(0)
      ? Number((latestMetric.memUsed * BigInt(100)) / latestMetric.memTotal)
      : null;
  const diskPct =
    latestMetric && latestMetric.diskTotal > BigInt(0)
      ? Number((latestMetric.diskUsed * BigInt(100)) / latestMetric.diskTotal)
      : null;

  return {
    period,
    updatedAt: new Date().toISOString(),
    kpi: {
      servicesOnline: `${online}/${deployed.length}`,
      leadsToday: "—",
      visits: "—",
      cpuRam:
        latestMetric != null
          ? `${latestMetric.cpu.toFixed(0)}% / ${memPct ?? "—"}%`
          : "—",
      certDays: nearestCertDays != null ? String(nearestCertDays) : "—",
    },
    sidefoot: [
      { label: "Сервисов онлайн", value: `${online}/${deployed.length}` },
      {
        label: "CPU / RAM",
        value:
          latestMetric != null
            ? `${latestMetric.cpu.toFixed(0)}% / ${memPct ?? "—"}%`
            : "—",
      },
      {
        label: "Диск",
        value: diskPct != null ? `${diskPct}%` : "—",
      },
    ],
    alerts,
    services: serviceRows.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      url: s.url,
      status: s.status,
      isDeployed: s.isDeployed,
      lastResponseMs: s.lastResponseMs,
      lastCheckedAt: s.lastCheckedAt,
      certExpiresAt: s.certExpiresAt,
      uptime24: s.uptime24,
      uptime7d: s.uptime7d,
      spark: s.spark,
      tags: s.tags,
    })),
    charts: {
      server: metrics.map((m) => ({
        t: m.takenAt.toISOString(),
        cpu: m.cpu,
        mem:
          m.memTotal > BigInt(0) ? Number((m.memUsed * BigInt(100)) / m.memTotal) : 0,
        disk:
          m.diskTotal > BigInt(0) ? Number((m.diskUsed * BigInt(100)) / m.diskTotal) : 0,
      })),
      response: responseSeries,
    },
  };
}
