"use client";

import { ServiceStudioLinks } from "@/components/services/ServiceStudioLinks";
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
import type { StudioCabinetLink } from "@/lib/studio-service-links";
import Link from "next/link";
import { useMemo, useState } from "react";

type HubBlock = {
  status: "ok" | "unavailable" | "not_configured" | "bad_response";
  message: string | null;
  code: string | null;
  kpi: Record<string, unknown> | null;
  series: Record<string, unknown>[];
  health: {
    ok: boolean;
    issues: string[];
    collectors?: unknown;
    watchdog?: unknown;
  } | null;
};

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
  containers: { name: string; state: "up" | "down"; status: string }[];
  chat: HubBlock;
  leads: HubBlock;
  charts: {
    server: { t: string; cpu: number; mem: number; disk: number }[];
    network: { t: string; rxMbps: number; txMbps: number }[];
    response: { label: string; data: { t: string; ms: number }[] }[];
  };
  cabinets: StudioCabinetLink[];
};

type Period = "day" | "week" | "month";

function statusTone(s: string): "up" | "down" | "degraded" | "unknown" {
  if (s === "UP") return "up";
  if (s === "DOWN") return "down";
  if (s === "DEGRADED") return "degraded";
  return "unknown";
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function fmtNum(v: unknown): string {
  const n = asNum(v);
  return n != null ? n.toLocaleString("ru-RU") : "—";
}

function chartLabels(
  iso: string[],
  period: Period,
): string[] {
  return iso.map((t) => {
    const d = new Date(t);
    if (period === "day") {
      return d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      });
    }
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Europe/Moscow",
    });
  });
}

function HubUnavailable({ block, title }: { block: HubBlock; title: string }) {
  return (
    <Alert title={title} tone="warn">
      {block.message || "Пока нет данных / сервис недоступен"}
    </Alert>
  );
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

  const serverChart = useMemo(
    () => ({
      labels: chartLabels(
        summary.charts.server.map((p) => p.t),
        period,
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
    }),
    [summary.charts.server, period],
  );

  const networkChart = useMemo(
    () => ({
      labels: chartLabels(
        summary.charts.network.map((p) => p.t),
        period,
      ),
      datasets: [
        {
          label: "↓ Мбит/с",
          data: summary.charts.network.map((p) => p.rxMbps),
          borderColor: "var(--gr)",
          backgroundColor: "transparent",
          tension: 0.3,
        },
        {
          label: "↑ Мбит/с",
          data: summary.charts.network.map((p) => p.txMbps),
          borderColor: "var(--vi)",
          backgroundColor: "transparent",
          tension: 0.3,
        },
      ],
    }),
    [summary.charts.network, period],
  );

  const responseChart = useMemo(() => {
    const palette = [
      "var(--ac)",
      "var(--cy)",
      "var(--gr)",
      "var(--vi)",
      "var(--pk)",
    ];
    return {
      labels: chartLabels(
        summary.charts.response[0]?.data.map((p) => p.t) || [],
        period,
      ),
      datasets: summary.charts.response.map((series, i) => ({
        label: series.label,
        data: series.data.map((p) => p.ms),
        borderColor: palette[i % palette.length],
        backgroundColor: "transparent",
        tension: 0.3,
      })),
    };
  }, [summary.charts.response, period]);

  const chatClients = summary.chat.kpi?.clients as
    | Record<string, number>
    | undefined;
  const chatClientDoughnut = useMemo(() => {
    if (!chatClients) return null;
    const keys = ["DEMO", "ACTIVE", "PAUSED", "EXPIRED", "OFF"] as const;
    const data = keys.map((k) => asNum(chatClients[k]) ?? 0);
    if (data.every((n) => n === 0)) return null;
    return {
      labels: [...keys],
      datasets: [
        {
          data,
          backgroundColor: [
            "var(--cy)",
            "var(--gr)",
            "var(--yl)",
            "var(--rd)",
            "var(--mu)",
          ],
          borderWidth: 0,
        },
      ],
    };
  }, [chatClients]);

  const chatSeriesChart = useMemo(() => {
    const series = summary.chat.series;
    if (!series.length) return null;
    const labels = series.map((p) => {
      const t = typeof p.t === "string" ? p.t : "";
      return chartLabels([t], period)[0] || t;
    });
    return {
      labels,
      datasets: [
        {
          label: "Диалоги",
          data: series.map((p) => asNum(p.dialogs) ?? 0),
          borderColor: "var(--ac)",
          backgroundColor: "transparent",
          tension: 0.3,
        },
        {
          label: "Сообщения",
          data: series.map((p) => asNum(p.messages) ?? 0),
          borderColor: "var(--cy)",
          backgroundColor: "transparent",
          tension: 0.3,
        },
        {
          label: "Заявки",
          data: series.map((p) => asNum(p.leads) ?? 0),
          borderColor: "var(--gr)",
          backgroundColor: "transparent",
          tension: 0.3,
        },
      ],
    };
  }, [summary.chat.series, period]);

  const leadsSeriesChart = useMemo(() => {
    const series = summary.leads.series;
    if (!series.length) return null;
    const labels = series.map((p) => {
      const t = typeof p.t === "string" ? p.t : "";
      return chartLabels([t], period)[0] || t;
    });
    return {
      labels,
      datasets: [
        {
          label: "Profi",
          data: series.map((p) => asNum(p.profi) ?? 0),
          backgroundColor: "var(--ac)",
        },
        {
          label: "YouDo",
          data: series.map((p) => asNum(p.youdo) ?? 0),
          backgroundColor: "var(--cy)",
        },
        {
          label: "Доставлено",
          data: series.map((p) => asNum(p.delivered) ?? 0),
          backgroundColor: "var(--gr)",
        },
        {
          label: "Отсеяно",
          data: series.map((p) => asNum(p.filtered) ?? 0),
          backgroundColor: "var(--yl)",
        },
      ],
    };
  }, [summary.leads.series, period]);

  const tg = summary.chat.kpi?.deliveries as
    | { telegram?: { sent?: number; failed?: number; pending?: number }; max?: { sent?: number; failed?: number; pending?: number } }
    | undefined;

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
        <CardHeader title="Кабинеты сервисов" subtitle="быстрый вход студии" />
        <ServiceStudioLinks links={summary.cabinets} emphasizeFirst={false} />
      </Card>

      <h2 className="text-[16.5px] font-extrabold text-tx">Сервер</h2>
      <div className="grid-g2">
        <Card>
          <CardHeader title="Нагрузка" subtitle="CPU / RAM / диск" />
          {summary.charts.server.length ? (
            <Chart data={serverChart} />
          ) : (
            <p className="text-[13px] text-mu">
              Запустите worker — метрики появятся через минуту.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="Сеть" subtitle="Мбит/с входящая / исходящая" />
          {summary.charts.network.length ? (
            <Chart data={networkChart} />
          ) : (
            <p className="text-[13px] text-mu">Пока мало точек для скорости сети.</p>
          )}
        </Card>
      </div>

      <div className="grid-g2">
        <Card>
          <CardHeader title="Время ответа" subtitle="мс по сервисам" />
          {summary.charts.response.some((s) => s.data.length) ? (
            <Chart data={responseChart} />
          ) : (
            <p className="text-[13px] text-mu">Пока нет проверок.</p>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Контейнеры"
            subtitle="только статус, без управления"
            action={<Pill tone="demo">docker</Pill>}
          />
          {summary.containers.length === 0 ? (
            <p className="text-[13px] text-mu">
              Список пуст или Docker недоступен из приложения.
            </p>
          ) : (
            <DataTable
              rows={summary.containers}
              rowKey={(r) => r.name}
              columns={[
                {
                  key: "name",
                  header: "Имя",
                  render: (r) => (
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <StatusDot status={r.state === "up" ? "up" : "down"} />
                      {r.name}
                    </span>
                  ),
                },
                {
                  key: "state",
                  header: "Состояние",
                  render: (r) => (r.state === "up" ? "up" : "down"),
                },
                {
                  key: "status",
                  header: "Статус",
                  render: (r) => (
                    <span className="text-[12.5px] text-mu">{r.status}</span>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

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

      <h2 className="text-[16.5px] font-extrabold text-tx">Чат</h2>
      {summary.chat.status !== "ok" ? (
        <HubUnavailable block={summary.chat} title="Чат" />
      ) : (
        <>
          <div className="grid-k5">
            <Kpi
              label="Клиенты"
              value={fmtNum(
                chatClients?.total ??
                  (asNum(chatClients?.ACTIVE) ?? 0) +
                    (asNum(chatClients?.DEMO) ?? 0) +
                    (asNum(chatClients?.PAUSED) ?? 0),
              )}
            />
            <Kpi label="Диалоги" value={fmtNum(summary.chat.kpi?.dialogs)} />
            <Kpi label="Сообщения" value={fmtNum(summary.chat.kpi?.messages)} />
            <Kpi label="Заявки" value={fmtNum(summary.chat.kpi?.leads)} />
            <Kpi
              label="Ошибки LLM"
              value={fmtNum(summary.chat.kpi?.llmErrors)}
              tone="warn"
            />
          </div>
          <div className="grid-g2">
            <Card>
              <CardHeader title="Клиенты по статусам" />
              {chatClientDoughnut ? (
                <Chart type="doughnut" data={chatClientDoughnut} height={200} />
              ) : (
                <p className="text-[13px] text-mu">Нет разбивки клиентов.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Динамика" subtitle="за период" />
              {chatSeriesChart ? (
                <Chart data={chatSeriesChart} />
              ) : (
                <p className="text-[13px] text-mu">Нет series.</p>
              )}
            </Card>
          </div>
          <Card>
            <CardHeader title="Доставки" subtitle="Telegram / MAX" />
            <div className="grid gap-2 text-[13px] sm:grid-cols-2">
              <p>
                Telegram: sent {fmtNum(tg?.telegram?.sent)} · failed{" "}
                {fmtNum(tg?.telegram?.failed)} · pending{" "}
                {fmtNum(tg?.telegram?.pending)}
              </p>
              <p>
                MAX: sent {fmtNum(tg?.max?.sent)} · failed{" "}
                {fmtNum(tg?.max?.failed)} · pending {fmtNum(tg?.max?.pending)}
              </p>
              <p className="text-mu sm:col-span-2">
                Вызовы оператора: {fmtNum(summary.chat.kpi?.handoffs)}
                {summary.chat.health
                  ? ` · health ${summary.chat.health.ok ? "ok" : "проблемы"}`
                  : ""}
              </p>
            </div>
          </Card>
        </>
      )}

      <h2 className="text-[16.5px] font-extrabold text-tx">Лиды</h2>
      {summary.leads.status !== "ok" ? (
        <HubUnavailable block={summary.leads} title="Лиды" />
      ) : (
        <>
          <div className="grid-k5">
            <Kpi label="Заявки" value={fmtNum(summary.leads.kpi?.leads)} />
            <Kpi
              label="Profi"
              value={fmtNum(
                (summary.leads.kpi?.bySource as { profi?: { leads?: number } })
                  ?.profi?.leads,
              )}
            />
            <Kpi
              label="YouDo"
              value={fmtNum(
                (summary.leads.kpi?.bySource as { youdo?: { leads?: number } })
                  ?.youdo?.leads,
              )}
            />
            <Kpi label="Отсеяно" value={fmtNum(summary.leads.kpi?.filtered)} />
            <Kpi
              label="Лаг p95, с"
              value={fmtNum(
                (summary.leads.kpi?.lag as { p95Sec?: number })?.p95Sec,
              )}
              tone="warn"
            />
          </div>
          <div className="grid-g2">
            <Card>
              <CardHeader title="Заявки по источникам" subtitle="за период" />
              {leadsSeriesChart ? (
                <Chart type="bar" data={leadsSeriesChart} />
              ) : (
                <p className="text-[13px] text-mu">Нет series.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Очередь и сторож" />
              <div className="space-y-2 text-[13px]">
                {(() => {
                  const outbox = summary.leads.kpi?.outbox as
                    | {
                        sent?: number;
                        failed?: number;
                        pending?: number;
                        retrying?: number;
                      }
                    | undefined;
                  const wd = summary.leads.health?.watchdog as
                    | {
                        openIncidents?: { key: string; message: string }[];
                        nextReport?: string;
                      }
                    | undefined;
                  const collectors = summary.leads.health?.collectors as
                    | { platform?: string; status?: string; cbState?: string }[]
                    | undefined;
                  return (
                    <>
                      <p>
                        Outbox: sent {fmtNum(outbox?.sent)} · pending{" "}
                        {fmtNum(outbox?.pending)} · retrying{" "}
                        {fmtNum(outbox?.retrying)} · failed{" "}
                        {fmtNum(outbox?.failed)}
                      </p>
                      <p>
                        Лаг avg:{" "}
                        {fmtNum(
                          (summary.leads.kpi?.lag as { avgSec?: number })
                            ?.avgSec,
                        )}{" "}
                        с
                      </p>
                      {collectors?.length ? (
                        <ul className="list-inside list-disc text-mu">
                          {collectors.map((c, i) => (
                            <li key={`${c.platform}-${i}`}>
                              {c.platform}: {c.status || "—"}
                              {c.cbState ? ` · CB ${c.cbState}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {wd?.openIncidents?.length ? (
                        <p className="text-[color:var(--rd)]">
                          Инциденты:{" "}
                          {wd.openIncidents
                            .map((x) => x.message || x.key)
                            .join("; ")}
                        </p>
                      ) : (
                        <p className="text-mu">Открытых инцидентов нет</p>
                      )}
                      {wd?.nextReport ? (
                        <p className="text-mu">
                          Вечерний отчёт: {wd.nextReport}
                        </p>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
