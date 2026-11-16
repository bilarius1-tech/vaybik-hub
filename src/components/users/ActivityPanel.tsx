"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useState } from "react";

type LogRow = {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
};

type Props = { initialLogs: LogRow[] };

export function ActivityPanel({ initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (action) qs.set("action", action);
    if (entity) qs.set("entity", entity);
    qs.set("limit", "100");
    const res = await api<{ logs: LogRow[] }>(`/api/activity?${qs}`);
    setLoading(false);
    if (res.data) setLogs(res.data.logs);
  }

  return (
    <div className="space-y-6">
      <h2 className="mb-3 mt-[10px] text-[16.5px] font-extrabold text-tx">
        Журнал действий
      </h2>
      <Card>
        <CardHeader title="Фильтры" />
        <div className="grid-g3 items-end">
          <Field label="Действие содержит" htmlFor="fa">
            <Input
              id="fa"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="auth.login"
            />
          </Field>
          <Field label="Сущность" htmlFor="fe">
            <Input
              id="fe"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="User"
            />
          </Field>
          <Button variant="ghost" disabled={loading} onClick={() => void load()}>
            Обновить
          </Button>
        </div>
      </Card>
      <Card>
        <DataTable
          rows={logs}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "t",
              header: "Время",
              render: (r) => formatDateTime(r.createdAt),
            },
            { key: "a", header: "Действие", render: (r) => r.action },
            {
              key: "e",
              header: "Объект",
              render: (r) =>
                `${r.entity}${r.entityId ? `:${r.entityId.slice(0, 8)}` : ""}`,
            },
            { key: "ip", header: "IP", render: (r) => r.ip || "—" },
            {
              key: "actor",
              header: "Actor",
              render: (r) => (r.actorId ? r.actorId.slice(0, 8) : "—"),
            },
          ]}
        />
      </Card>
    </div>
  );
}
