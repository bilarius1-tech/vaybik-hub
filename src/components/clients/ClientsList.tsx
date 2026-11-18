"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  siteUrl: string | null;
  contact: string | null;
  status: "active" | "paused" | "archived";
  createdAt: string;
  services: { id: string; status: string; service: { name: string; slug: string } }[];
};

function statusPill(s: Row["status"]) {
  if (s === "active") return <Pill tone="green">активен</Pill>;
  if (s === "paused") return <Pill tone="yellow">пауза</Pill>;
  return <Pill tone="red">архив</Pill>;
}

export function ClientsList({
  initial,
  initialQ,
  initialStatus,
  chatApiReady,
  chatMissingKeys,
}: {
  initial: Row[];
  initialQ: string;
  initialStatus: string;
  chatApiReady: boolean;
  chatMissingKeys: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      const qs = params.toString();
      router.replace(qs ? `/clients?${qs}` : "/clients");
    }, 300);
    return () => clearTimeout(t);
  }, [q, status, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
          Клиенты
        </h2>
        <Link href="/clients/new">
          <Button>Создать клиента</Button>
        </Link>
      </div>

      {!chatApiReady ? (
        <p className="text-[12.5px] text-mu">
          Подключение Чата выключено, пока в .env нет:{" "}
          {chatMissingKeys.join(", ") || "CHAT_BASE_URL, HUB_CHAT_API_SECRET"}.
          Можно создать клиента и указать externalId вручную.
        </p>
      ) : null}

      <Card>
        <CardHeader title="Список" subtitle="реестр клиентов студии" />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени, контакту, сайту"
            className="max-w-sm"
          />
          <Segmented
            value={status as "all" | "active" | "paused" | "archived"}
            onChange={(v) => setStatus(v)}
            options={[
              { value: "all", label: "Все" },
              { value: "active", label: "Активные" },
              { value: "paused", label: "Пауза" },
              { value: "archived", label: "Архив" },
            ]}
          />
        </div>

        {initial.length === 0 ? (
          <EmptyState
            title="Пока нет клиентов"
            description="Создайте первого клиента и подключите продукт «Чат»."
            action={
              <Link href="/clients/new">
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
                header: "Клиент",
                render: (r) => (
                  <Link
                    href={`/clients/${r.id}`}
                    className="font-semibold hover:text-ac"
                  >
                    {r.name}
                  </Link>
                ),
              },
              {
                key: "status",
                header: "Статус",
                render: (r) => statusPill(r.status),
              },
              {
                key: "svc",
                header: "Сервисы",
                render: (r) =>
                  r.services.length
                    ? r.services
                        .map((s) => `${s.service.name} (${s.status})`)
                        .join(", ")
                    : "—",
              },
              {
                key: "site",
                header: "Сайт",
                render: (r) => r.siteUrl || "—",
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
