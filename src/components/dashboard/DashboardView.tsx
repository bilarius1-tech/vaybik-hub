"use client";

import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chart } from "@/components/ui/Chart";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kpi } from "@/components/ui/Kpi";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusDot } from "@/components/ui/StatusDot";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { useState } from "react";

type Summary = {
  period: string;
  updatedAt: string;
  kpi: {
    servicesOnline: string;
    leadsToday: string;
    visits: string;
    cpuRam: string;
    certDays: string;
  };
  alerts: { tone: "warn" | "bad"; title: string; body: string }[];
  services: {
    id: string;
    slug: string;
    name: string;
    url: string;
    status: "UP" | "DOWN" | "DEGRADED" | "UNKNOWN";
    isDeployed: boolean;
    lastResponseMs: number | null;
    uptime24: number | null;
    uptime7d: number | null;
    spark: number[];
    tags: string[];
  }[];
  charts: {
    server: { t: string; cpu: number; mem: number; disk: number }[];
    response: { label: string; data: { t: string; ms: number }[] }[];
  };
};

type Period = "day" | "week" | "month";

function statusTone(s: string): "up" | "down" | "degraded" | "unknown" {
  if (s === "UP") return "up";
  if (s === "DOWN") return "down";
  if (s === "DEGRADED") return "degraded";
  return "unknown";
}

export function DashboardView({ initial }: { initial: Summary }) {
  const [summary, setSummary] = useState(initial);
  const [period, setPeriod] = useState<Period>("week");
  const [loading, setLoading] = useState(false);

  async function changePeriod(p: Period) {
    setPeriod(p);
    setLoading(true);
    const res = await api<Summary>(`/api/dashboard/summary?period=${p}`);
    setLoading(false);
    if (res.data) setSummary(res.data);
  }

  const serverChart = {
    labels: summary.charts.server.map((p) =>
      new Date(p.t).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    ),
    datasets: [
      {
        label: "CPU %",
        data: summary.charts.server.map((p) => p.cpu),
        borderColor: "var(--ac)",
        backgroundColor: "transparent",
        tension: 0.3,
      },
      {
        label: "RAM %",
        data: summary.charts.server.map((p) => p.mem),
        borderColor: "var(--cy)",
        backgroundColor: "transparent",
        tension: 0.3,
      },
      {
        label: "Диск %",
        data: summary.charts.server.map((p) => p.disk),
        borderColor: "var(--yl)",
        backgroundColor: "transparent",
        tension: 0.3,
      },
    ],
  };

  const palette = ["var(--ac)", "var(--cy)", "var(--gr)", "var(--vi)", "var(--pk)"];
  const responseChart = {
    labels:
      summary.charts.response[0]?.data.map((p) =>
        new Date(p.t).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      ) || [],
    datasets: summary.charts.response.map((series, i) => ({
      label: series.label,
      data: series.data.map((p) => p.ms),
      borderColor: palette[i % palette.length],
      backgroundColor: "transparent",
      tension: 0.3,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">Дашборд</h2>
        <Segmented
          aria-label="Период"
          value={period}
          onChange={(v) => void changePeriod(v)}
          options={[
            { value: "day", label: "День" },
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" },
          ]}
        />
      </div>
      <p className="text-[12.5px] text-mu">
        обновлено {formatDateTime(summary.updatedAt)}
        {loading ? " · загружаем…" : ""}
      </p>

      <div className="grid-k5">
        <Kpi label="Сервисов онлайн" value={summary.kpi.servicesOnline} />
        <Kpi label="Заявок сегодня" value={summary.kpi.leadsToday} />
        <Kpi label="Визиты" value={summary.kpi.visits} />
        <Kpi label="CPU / RAM" value={summary.kpi.cpuRam} tone="warn" />
        <Kpi label="До сертификата" value={summary.kpi.certDays} />
      </div>

      {summary.alerts.length > 0 ? (
        <section className="grid-g2">
          {summary.alerts.map((a, i) => (
            <Alert key={`${a.title}-${i}`} title={a.title} tone={a.tone}>
              {a.body}
            </Alert>
          ))}
        </section>
      ) : null}

      <Card>
        <CardHeader
          title="Сервисы"
          subtitle="статус и аптайм"
          action={<Pill tone="demo">live</Pill>}
        />
        {summary.services.length === 0 ? (
          <EmptyState
            title="Нет сервисов"
            description="Добавьте сервис в реестре."
            action={
              <Link href="/services/new" className="text-ac underline">
                Создать
              </Link>
            }
          />
        ) : (
          <DataTable
            rows={summary.services}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "name",
                header: "Сервис",
                render: (r) => (
                  <Link
                    href={`/services/${r.slug}`}
                    className="inline-flex items-center gap-2 font-semibold hover:text-ac"
                  >
                    <StatusDot status={statusTone(r.status)} />
                    {r.name}
                    {!r.isDeployed ? (
                      <Pill tone="yellow">не развёрнут</Pill>
                    ) : null}
                  </Link>
                ),
              },
              {
                key: "ms",
                header: "мс",
                render: (r) =>
                  r.lastResponseMs != null
                    ? r.lastResponseMs.toLocaleString("ru-RU")
                    : "—",
              },
              {
                key: "u24",
                header: "аптайм 24ч",
                render: (r) => (r.uptime24 != null ? `${r.uptime24}%` : "—"),
              },
              {
                key: "u7",
                header: "7д",
                render: (r) => (r.uptime7d != null ? `${r.uptime7d}%` : "—"),
              },
              {
                key: "spark",
                header: "24ч",
                render: (r) => <Sparkline values={r.spark} />,
              },
            ]}
          />
        )}
      </Card>

      <div className="grid-g2">
        <Card>
          <CardHeader title="Нагрузка сервера" subtitle="CPU / RAM / диск" />
          {summary.charts.server.length ? (
            <Chart data={serverChart} />
          ) : (
            <p className="text-[13px] text-mu">
              Запустите worker — метрики появятся через минуту.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="Время ответа" subtitle="мс по сервисам" />
          {summary.charts.response.some((s) => s.data.length) ? (
            <Chart data={responseChart} />
          ) : (
            <p className="text-[13px] text-mu">Пока нет проверок.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
