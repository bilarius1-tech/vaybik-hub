"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api-client";
import { serviceStatusLabel } from "@/lib/client-status-labels";
import { useState } from "react";

type ServiceRow = {
  id: string;
  status: string;
  activeFrom: string | null;
  activeUntil: string | null;
  paymentNote: string | null;
  slug: string;
  name: string;
  canOpen: boolean;
};

type Props = {
  clientName: string;
  siteUrl: string | null;
  services: ServiceRow[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function MyServicesView({ clientName, siteUrl, services }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function openService(clientServiceId: string) {
    setBusyId(clientServiceId);
    setError(null);
    const res = await api<{ redirectUrl: string }>("/api/my/services/open", {
      method: "POST",
      body: JSON.stringify({ clientServiceId }),
    });
    setBusyId(null);
    if (res.error || !res.data?.redirectUrl) {
      setError(res.error?.message || "Не удалось открыть сервис");
      return;
    }
    window.location.assign(res.data.redirectUrl);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
          Мои сервисы
        </h2>
        <p className="mt-1 text-[13px] text-mu">
          {clientName}
          {siteUrl ? ` · ${siteUrl}` : ""}
        </p>
      </div>

      {error ? (
        <div className="rounded-[10px] border border-[color-mix(in_srgb,var(--rd)_40%,var(--bd))] bg-[color-mix(in_srgb,var(--rd)_8%,transparent)] px-3 py-2 text-[13px] text-rd">
          {error}
        </div>
      ) : null}

      {services.length === 0 ? (
        <Card>
          <CardHeader
            title="Пока пусто"
            subtitle="студия ещё не подключила сервисы"
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {services.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-extrabold text-tx">
                      {s.name}
                    </h3>
                    <Pill
                      tone={
                        s.status === "active"
                          ? "green"
                          : s.status === "paused"
                            ? "yellow"
                            : "red"
                      }
                    >
                      {serviceStatusLabel(s.status)}
                    </Pill>
                  </div>
                  <p className="mt-2 text-[13px] text-mu">
                    Срок: {fmtDate(s.activeFrom)} — {fmtDate(s.activeUntil)}
                    <span className="text-mu"> (только просмотр)</span>
                  </p>
                  {s.paymentNote ? (
                    <p className="mt-1 text-[12.5px] text-mu">
                      Оплата: {s.paymentNote}
                    </p>
                  ) : null}
                </div>
                {s.canOpen ? (
                  <Button
                    disabled={busyId === s.id}
                    onClick={() => void openService(s.id)}
                  >
                    {busyId === s.id ? "Открываем…" : "Открыть"}
                  </Button>
                ) : (
                  <span className="text-[12.5px] text-mu">скоро</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
