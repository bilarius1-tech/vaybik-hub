"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Sparkline } from "@/components/ui/Sparkline";
import { AddConnectionForm } from "@/components/databases/AddConnectionForm";
import { api } from "@/lib/api-client";

type Conn = {
  id: string;
  slug: string;
  name: string;
  engine: string;
  host: string;
  port: number;
  database: string;
  isSystem: boolean;
  lastSizeBytes: string | null;
  lastTableCount: number | null;
  lastPgVersion: string | null;
  backups: Array<{
    id: string;
    status: string;
    startedAt: string;
    error: string | null;
  }>;
  sizeSnapshots: Array<{ sizeBytes: string; takenAt: string }>;
};

function fmtBytes(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DatabasesPanel() {
  const [rows, setRows] = useState<Conn[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<{ connections: Conn[] }>("/api/databases");
    setLoading(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setErr(null);
    setRows(res.data?.connections ?? []);
  }, []);

  useEffect(() => {
    // Загрузка реестра при открытии страницы
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
          Базы данных
        </h2>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          Обновить
        </Button>
      </div>

      {err ? (
        <p className="text-[13px] text-danger" role="alert">
          {err}
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="Реестр подключений"
          subtitle="размеры, последний бэкап, рост"
        />
        {loading && rows.length === 0 ? (
          <p className="text-[13px] text-mu">Загрузка…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Пока пусто"
            description="Системная БД админки появится автоматически."
          />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "name",
                header: "Имя",
                render: (r) => (
                  <Link
                    href={`/databases/${r.id}`}
                    className="font-semibold hover:text-ac"
                  >
                    {r.name}
                    {r.isSystem ? (
                      <Pill tone="yellow" className="ml-2">
                        система
                      </Pill>
                    ) : null}
                  </Link>
                ),
              },
              {
                key: "engine",
                header: "Тип",
                render: (r) => r.engine,
              },
              {
                key: "host",
                header: "Хост",
                render: (r) => `${r.host}:${r.port}`,
              },
              {
                key: "db",
                header: "БД",
                render: (r) => r.database,
              },
              {
                key: "size",
                header: "Размер",
                render: (r) => fmtBytes(r.lastSizeBytes),
              },
              {
                key: "tables",
                header: "Таблиц",
                render: (r) =>
                  r.lastTableCount != null
                    ? r.lastTableCount.toLocaleString("ru-RU")
                    : "—",
              },
              {
                key: "backup",
                header: "Бэкап",
                render: (r) => {
                  const b = r.backups[0];
                  if (!b) return "—";
                  const tone =
                    b.status === "ok" || b.status === "verified"
                      ? "up"
                      : b.status === "error"
                        ? "down"
                        : "unknown";
                  return (
                    <span className="inline-flex items-center gap-2">
                      <Pill tone={tone === "up" ? "green" : tone === "down" ? "red" : "yellow"}>
                        {b.status}
                      </Pill>
                      <span className="text-mu">{fmtDate(b.startedAt)}</span>
                    </span>
                  );
                },
              },
              {
                key: "growth",
                header: "Рост",
                render: (r) => (
                  <Sparkline
                    values={r.sizeSnapshots.map((s) => Number(s.sizeBytes) || 0)}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>

      <AddConnectionForm onCreated={() => void load()} />
    </div>
  );
}
