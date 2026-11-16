"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusDot } from "@/components/ui/StatusDot";
import Link from "next/link";

type Row = {
  id: string;
  slug: string;
  name: string;
  url: string;
  status: string;
  isDeployed: boolean;
  lastResponseMs: number | null;
  spark: number[];
  uptime24: number | null;
  tags: string[];
};

function tone(s: string): "up" | "down" | "degraded" | "unknown" {
  if (s === "UP") return "up";
  if (s === "DOWN") return "down";
  if (s === "DEGRADED") return "degraded";
  return "unknown";
}

export function ServicesList({ initial }: { initial: Row[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">Сервисы</h2>
        <Link href="/services/new">
          <Button>Добавить</Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="Реестр" subtitle="поддомены и health-checks" />
        {initial.length === 0 ? (
          <EmptyState
            title="Пока пусто"
            description="Создайте первый сервис."
            action={
              <Link href="/services/new">
                <Button variant="ghost">Создать</Button>
              </Link>
            }
          />
        ) : (
          <DataTable
            rows={initial}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "name",
                header: "Название",
                render: (r) => (
                  <Link
                    href={`/services/${r.slug}`}
                    className="inline-flex items-center gap-2 font-semibold hover:text-ac"
                  >
                    <StatusDot status={tone(r.status)} />
                    {r.name}
                  </Link>
                ),
              },
              { key: "url", header: "URL", render: (r) => r.url },
              {
                key: "dep",
                header: "",
                render: (r) =>
                  r.isDeployed ? null : <Pill tone="yellow">не развёрнут</Pill>,
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
                key: "up",
                header: "аптайм 24ч",
                render: (r) => (r.uptime24 != null ? `${r.uptime24}%` : "—"),
              },
              {
                key: "spark",
                header: "спарклайн",
                render: (r) => <Sparkline values={r.spark} />,
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
