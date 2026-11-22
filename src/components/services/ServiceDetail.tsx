"use client";

import { DockerPanel } from "@/components/services/DockerPanel";
import { ServiceForm } from "@/components/services/ServiceForm";
import { ServiceSeoPanel } from "@/components/services/ServiceSeoPanel";
import { ServiceStudioLinks } from "@/components/services/ServiceStudioLinks";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chart } from "@/components/ui/Chart";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { StatusDot } from "@/components/ui/StatusDot";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { studioLinksForService } from "@/lib/studio-service-links";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Service = {
  id: string;
  slug: string;
  name: string;
  url: string;
  description: string | null;
  type: "DOCKER" | "EXTERNAL" | "STATIC";
  containerNames: string[];
  healthUrl: string | null;
  expectedStatus: number;
  keyword: string | null;
  intervalSec: number;
  timeoutMs: number;
  isPublic: boolean;
  isDeployed: boolean;
  isProduct: boolean;
  publicPagePath: string | null;
  manageUrl: string | null;
  status: string;
  lastCheckedAt: string | null;
  lastResponseMs: number | null;
  certExpiresAt: string | null;
  tags: string[];
};

type Check = {
  id: string;
  status: string;
  httpStatus: number | null;
  responseMs: number | null;
  error: string | null;
  checkedAt: string;
};

function tone(s: string): "up" | "down" | "degraded" | "unknown" {
  if (s === "UP") return "up";
  if (s === "DOWN") return "down";
  if (s === "DEGRADED") return "degraded";
  return "unknown";
}

export function ServiceDetail({
  service,
  checks,
}: {
  service: Service;
  checks: Check[];
}) {
  const router = useRouter();
  const [yaml, setYaml] = useState<string | null>(null);
  const [port, setPort] = useState("3000");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chartData = {
    labels: [...checks]
      .reverse()
      .map((c) =>
        new Date(c.checkedAt).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    datasets: [
      {
        label: "мс",
        data: [...checks].reverse().map((c) => c.responseMs ?? 0),
        borderColor: "var(--ac)",
        backgroundColor: "transparent",
        tension: 0.3,
      },
    ],
  };

  async function runCheck() {
    setBusy(true);
    setErr(null);
    const res = await api(`/api/services/${service.id}/check`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (res.error) setErr(res.error.message);
    else {
      setMsg("Проверка выполнена");
      router.refresh();
    }
  }

  async function loadLabels() {
    const host = new URL(service.url).hostname;
    const res = await api<{ yaml: string }>(
      `/api/services/${service.id}/traefik-labels?subdomain=${encodeURIComponent(host)}&port=${port}`,
    );
    if (res.data) setYaml(res.data.yaml);
    else setErr(res.error?.message || "Ошибка");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mt-[10px] flex items-center gap-2 text-[16.5px] font-extrabold text-tx">
            <StatusDot status={tone(service.status)} />
            {service.name}
          </h2>
          <p className="text-[13px] text-mu">{service.url}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone="accent">{service.type}</Pill>
            {!service.isDeployed ? (
              <Pill tone="yellow">не развёрнут</Pill>
            ) : (
              <Pill
                tone={
                  service.status === "UP"
                    ? "green"
                    : service.status === "DOWN"
                      ? "red"
                      : "yellow"
                }
              >
                {service.status}
              </Pill>
            )}
          </div>
          <ServiceStudioLinks
            links={studioLinksForService(service.slug)}
            className="mt-3 flex flex-wrap items-center gap-2"
          />
        </div>
        <Button onClick={() => void runCheck()} disabled={busy || !service.healthUrl}>
          {busy ? "Проверяем…" : "Проверить сейчас"}
        </Button>
      </div>
      {msg ? <p className="text-[13px] text-gr">{msg}</p> : null}
      {err ? <p className="text-[13px] text-rd">{err}</p> : null}

      <div className="grid-g2">
        <Card>
          <CardHeader title="Время ответа" subtitle="последние проверки" />
          {checks.length ? (
            <Chart data={chartData} />
          ) : (
            <p className="text-[13px] text-mu">Нет данных</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Сводка" />
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-mu">Последняя проверка</dt>
              <dd>
                {service.lastCheckedAt
                  ? formatDateTime(service.lastCheckedAt)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-mu">Ответ</dt>
              <dd>
                {service.lastResponseMs != null
                  ? `${service.lastResponseMs} мс`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-mu">SSL до</dt>
              <dd>
                {service.certExpiresAt
                  ? formatDateTime(service.certExpiresAt)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-mu">Health URL</dt>
              <dd className="truncate">{service.healthUrl || "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="История проверок" />
        <DataTable
          rows={checks}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "t",
              header: "Время",
              render: (r) => formatDateTime(r.checkedAt),
            },
            {
              key: "s",
              header: "Статус",
              render: (r) => (
                <span className="inline-flex items-center gap-2">
                  <StatusDot status={tone(r.status)} pulse={false} />
                  {r.status}
                </span>
              ),
            },
            {
              key: "code",
              header: "HTTP",
              render: (r) => r.httpStatus ?? "—",
            },
            {
              key: "ms",
              header: "мс",
              render: (r) => r.responseMs ?? "—",
            },
            {
              key: "err",
              header: "Ошибка",
              render: (r) => (
                <span className="text-mu">{r.error || "—"}</span>
              ),
            },
          ]}
        />
      </Card>

      {service.type === "DOCKER" ? (
        <DockerPanel
          serviceId={service.id}
          containerNames={service.containerNames || []}
        />
      ) : null}

      <Card>
        <CardHeader
          title="Traefik labels"
          subtitle="YAML для копирования в docker-compose"
        />
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label="Порт контейнера" htmlFor="port">
            <Input
              id="port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </Field>
          <Button variant="ghost" onClick={() => void loadLabels()}>
            Сгенерировать
          </Button>
        </div>
        {yaml ? (
          <pre className="overflow-x-auto rounded-md border border-bd bg-bg2 p-3 text-[12px] text-tx">
            {yaml}
          </pre>
        ) : null}
      </Card>

      <ServiceForm
        mode="edit"
        serviceId={service.id}
        initial={{
          slug: service.slug,
          name: service.name,
          url: service.url,
          description: service.description,
          type: service.type,
          containerNames: service.containerNames || [],
          healthUrl: service.healthUrl,
          expectedStatus: service.expectedStatus,
          keyword: service.keyword,
          intervalSec: service.intervalSec,
          timeoutMs: service.timeoutMs,
          isPublic: service.isPublic,
          isDeployed: service.isDeployed,
          isProduct: service.isProduct,
          publicPagePath: service.publicPagePath,
          manageUrl: service.manageUrl,
          tags: service.tags,
        }}
      />

      <ServiceSeoPanel serviceId={service.id} />
    </div>
  );
}
