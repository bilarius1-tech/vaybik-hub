"use client";

import { DeleteClientControls } from "@/components/clients/DeleteClientControls";
import { ImpersonateControls } from "@/components/clients/ImpersonateControls";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { daysRemaining, periodTone } from "@/lib/period-ymd";
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
  deleteIncomplete: boolean;
  deleteIncompleteError: string | null;
  chatManageHref: string | null;
  canImpersonate: boolean;
  chatActiveUntil: string | null;
  services: {
    id: string;
    status: string;
    externalId: string | null;
    service: { name: string; slug: string };
  }[];
};

function statusPill(s: Row["status"]) {
  if (s === "active") return <Pill tone="green">активен</Pill>;
  if (s === "paused") return <Pill tone="yellow">пауза</Pill>;
  return <Pill tone="red">архив</Pill>;
}

function WorksUntilCell({ until }: { until: string | null }) {
  if (!until) return <span className="text-mu">—</span>;
  const tone = periodTone(until);
  const left = daysRemaining(until);
  if (tone === "expired") {
    return (
      <span className="font-semibold text-rd">
        {until} · истёк
      </span>
    );
  }
  if (tone === "warn") {
    return (
      <span className="font-semibold text-yl">
        {until} · осталось {left} дн.
      </span>
    );
  }
  return (
    <span className="text-tx">
      {until} · осталось {left} дн.
    </span>
  );
}

export function ClientsList({
  initial,
  initialQ,
  initialStatus,
  initialExpiry,
  initialSort,
  chatApiReady,
  chatMissingKeys,
  totpEnabled = false,
}: {
  initial: Row[];
  initialQ: string;
  initialStatus: string;
  initialExpiry: string;
  initialSort: string;
  chatApiReady: boolean;
  chatMissingKeys: string[];
  totpEnabled?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [expiry, setExpiry] = useState(initialExpiry);
  const [sort, setSort] = useState(initialSort);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      if (expiry !== "all") params.set("expiry", expiry);
      if (sort !== "created") params.set("sort", sort);
      const qs = params.toString();
      router.replace(qs ? `/clients?${qs}` : "/clients");
    }, 300);
    return () => clearTimeout(t);
  }, [q, status, expiry, sort, router]);

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

      {error ? (
        <p className="text-[13px] text-rd">{error}</p>
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
          <Segmented
            value={expiry as "all" | "expiring" | "expired"}
            onChange={(v) => setExpiry(v)}
            options={[
              { value: "all", label: "Срок: все" },
              { value: "expiring", label: "Истекает за 7 дн." },
              { value: "expired", label: "Истёк" },
            ]}
          />
          <Segmented
            value={sort as "created" | "until_asc" | "until_desc"}
            onChange={(v) => setSort(v)}
            options={[
              { value: "created", label: "Новые" },
              { value: "until_asc", label: "Конец ↑" },
              { value: "until_desc", label: "Конец ↓" },
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
            onRowClick={(r) => router.push(`/clients/${r.id}`)}
            columns={[
              {
                key: "name",
                header: "Клиент",
                render: (r) => (
                  <div>
                    <Link
                      href={`/clients/${r.id}`}
                      className="font-semibold text-tx underline-offset-2 hover:text-ac hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.name}
                    </Link>
                    {r.deleteIncomplete ? (
                      <div className="mt-0.5">
                        <Pill tone="red">удаление не завершено</Pill>
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Статус",
                render: (r) => statusPill(r.status),
              },
              {
                key: "until",
                header: "Работает до",
                render: (r) => <WorksUntilCell until={r.chatActiveUntil} />,
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
              {
                key: "actions",
                header: "Действия",
                className: "whitespace-nowrap",
                render: (r) => (
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    data-no-row-click
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`/clients/${r.id}`}>
                      <Button type="button" variant="ghost">
                        Открыть
                      </Button>
                    </Link>
                    <ImpersonateControls
                      clientId={r.id}
                      enabled={r.canImpersonate}
                      totpEnabled={totpEnabled}
                      onError={setError}
                    />
                    {r.chatManageHref ? (
                      <a
                        href={r.chatManageHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button type="button" variant="ghost">
                          Настроить
                        </Button>
                      </a>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled
                        title="Сначала подключите Чат с externalId"
                      >
                        Настроить
                      </Button>
                    )}
                    <DeleteClientControls
                      clientId={r.id}
                      clientName={r.name}
                      totpEnabled={totpEnabled}
                      incomplete={r.deleteIncomplete}
                      incompleteError={r.deleteIncompleteError}
                      onError={setError}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
