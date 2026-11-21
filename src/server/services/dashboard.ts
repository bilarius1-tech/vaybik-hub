import { prisma } from "@/server/db";
import { getChatSsoConfig } from "@/server/chat/config";
import { fetchChatHubStats } from "@/server/chat/stats-client";
import { listDashboardContainers } from "@/server/docker/dashboard-containers";
import type { HubStatsResult } from "@/server/hub-stats/types";
import { getLeadsSsoConfig } from "@/server/leads/config";
import { fetchLeadsHubStats } from "@/server/leads/stats-client";
import { studioCabinetLinks } from "@/lib/studio-service-links";
import {
  downsampleByTime,
  netRatesBps,
} from "@/server/services/downsample";
import { periodSince, type Period } from "@/server/services/period";

export type { Period } from "@/server/services/period";
export { periodSince } from "@/server/services/period";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

function nestedNum(obj: unknown, path: string[]): number | null {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return num(cur);
}

function formatLeadsToday(leads: HubStatsResult): string {
  if (leads.status !== "ok") return "—";
  const kpi = leads.data.kpi;
  const fromKpi = nestedNum(kpi, ["leads"]);
  if (fromKpi != null) return fromKpi.toLocaleString("ru-RU");
  const profi = nestedNum(kpi, ["bySource", "profi", "leads"]);
  const youdo = nestedNum(kpi, ["bySource", "youdo", "leads"]);
  if (profi != null || youdo != null) {
    return ((profi ?? 0) + (youdo ?? 0)).toLocaleString("ru-RU");
  }
  return "—";
}

function publicHubStats(result: HubStatsResult) {
  if (result.status !== "ok") {
    return {
      status: result.status as "unavailable" | "not_configured" | "bad_response",
      message: result.message,
      code: result.code,
      kpi: null as Record<string, unknown> | null,
      series: [] as Record<string, unknown>[],
      health: null as {
        ok: boolean;
        issues: string[];
      } | null,
    };
  }
  return {
    status: "ok" as const,
    message: null as string | null,
    code: null as string | null,
    kpi: result.data.kpi,
    series: result.data.series,
    health: result.data.health,
  };
}

export async function getDashboardSummary(
  period: Period = "week",
  opts?: { /** Только KPI/sidefoot — без stats чата/лидов и docker */ lite?: boolean },
) {
  const lite = opts?.lite === true;
  const since = periodSince(period);
  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const deployed = services.filter((s) => s.isDeployed);
  const online = deployed.filter((s) => s.status === "UP").length;

  const latestMetric = await prisma.serverMetric.findFirst({
    orderBy: { takenAt: "desc" },
  });

  const metricsRaw = await prisma.serverMetric.findMany({
    where: { takenAt: { gte: since } },
    orderBy: { takenAt: "asc" },
  });
  const metrics = downsampleByTime(metricsRaw, period);

  const netSeries = netRatesBps(
    metrics.map((m) => ({
      t: m.takenAt,
      rx: m.netRxBytes,
      tx: m.netTxBytes,
    })),
  );

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

  const emptyStats: HubStatsResult = {
    status: "not_configured",
    code: "SKIPPED",
    message: "—",
  };
  const [chatStats, leadsStats, containers] = lite
    ? [emptyStats, emptyStats, [] as Awaited<ReturnType<typeof listDashboardContainers>>]
    : await Promise.all([
        fetchChatHubStats(period),
        fetchLeadsHubStats(period),
        listDashboardContainers(),
      ]);

  // KPI «Заявок сегодня» — всегда day для лидов (даже если период week/month)
  const leadsTodayStats = lite
    ? emptyStats
    : period === "day"
      ? leadsStats
      : await fetchLeadsHubStats("day");

  if (!lite && chatStats.status !== "ok") {
    alerts.push({
      tone: "warn",
      title: "Чат недоступен",
      body: chatStats.message,
    });
  } else if (
    !lite &&
    chatStats.status === "ok" &&
    chatStats.data.health &&
    chatStats.data.health.ok === false
  ) {
    alerts.push({
      tone: "warn",
      title: "Чат: проблемы",
      body: chatStats.data.health.issues.join("; ") || "health.ok=false",
    });
  }

  if (!lite && leadsStats.status !== "ok") {
    alerts.push({
      tone: "warn",
      title: "Лиды недоступны",
      body: leadsStats.message,
    });
  } else if (
    !lite &&
    leadsStats.status === "ok" &&
    leadsStats.data.health &&
    leadsStats.data.health.ok === false
  ) {
    const issues = leadsStats.data.health.issues;
    alerts.push({
      tone: "warn",
      title: "Лиды: проблемы",
      body: issues.join("; ") || "health.ok=false",
    });
  }

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

  const responseSeries: { label: string; data: { t: string; ms: number }[] }[] =
    [];
  for (const s of deployed.slice(0, 5)) {
    const checks = await prisma.healthCheck.findMany({
      where: { serviceId: s.id, checkedAt: { gte: since }, responseMs: { not: null } },
      orderBy: { checkedAt: "asc" },
    });
    const thinChecks = downsampleByTime(
      checks.map((c) => ({ takenAt: c.checkedAt, ms: c.responseMs! })),
      period,
    );
    responseSeries.push({
      label: s.name,
      data: thinChecks.map((c) => ({
        t: c.takenAt.toISOString(),
        ms: c.ms,
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
      leadsToday: formatLeadsToday(leadsTodayStats),
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
    containers,
    cabinets: studioCabinetLinks({
      chatSsoReady: Boolean(getChatSsoConfig()),
      leadsSsoReady: Boolean(getLeadsSsoConfig()),
    }),
    chat: publicHubStats(chatStats),
    leads: publicHubStats(leadsStats),
    charts: {
      server: metrics.map((m) => ({
        t: m.takenAt.toISOString(),
        cpu: m.cpu,
        mem:
          m.memTotal > BigInt(0) ? Number((m.memUsed * BigInt(100)) / m.memTotal) : 0,
        disk:
          m.diskTotal > BigInt(0) ? Number((m.diskUsed * BigInt(100)) / m.diskTotal) : 0,
      })),
      network: netSeries.map((p) => ({
        t: p.t.toISOString(),
        /** Мбит/с */
        rxMbps: Number((p.rxBps / 1_000_000).toFixed(3)),
        txMbps: Number((p.txBps / 1_000_000).toFixed(3)),
      })),
      response: responseSeries,
    },
  };
}
