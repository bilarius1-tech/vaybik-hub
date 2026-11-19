"use client";

import { ClientAccessPanel } from "@/components/clients/ClientAccessPanel";
import { ConnectionStatusSelect } from "@/components/clients/ConnectionStatusSelect";
import { DeleteClientControls } from "@/components/clients/DeleteClientControls";
import { ImpersonateControls } from "@/components/clients/ImpersonateControls";
import { ServicePeriodControls } from "@/components/clients/ServicePeriodControls";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Toast, type ToastState } from "@/components/ui/Toast";
import { api } from "@/lib/api-client";
import {
  CLIENT_STATUS_LABEL,
  clientStatusLabel,
  serviceStatusLabel,
  type ClientStatusCode,
} from "@/lib/client-status-labels";
import { coerceYmd } from "@/lib/period-ymd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Cs = {
  id: string;
  status: "setup" | "active" | "paused" | "off";
  externalId: string | null;
  note: string | null;
  activeFrom: string | null;
  activeUntil: string | null;
  paymentNote: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  manageHref: string | null;
  service: {
    id: string;
    slug: string;
    name: string;
    isProduct: boolean;
    manageUrl: string | null;
  };
};

type Client = {
  id: string;
  name: string;
  siteUrl: string | null;
  contact: string | null;
  status: "active" | "paused" | "archived";
  deleteIncomplete?: boolean;
  deleteIncompleteError?: string | null;
  updatedAt?: string;
  services: Cs[];
};

function statusPill(s: Client["status"]) {
  if (s === "active") return <Pill tone="green">{clientStatusLabel(s)}</Pill>;
  if (s === "paused") return <Pill tone="yellow">{clientStatusLabel(s)}</Pill>;
  return <Pill tone="red">{clientStatusLabel(s)}</Pill>;
}

function csPill(s: Cs["status"]) {
  if (s === "active") return <Pill tone="green">{serviceStatusLabel(s)}</Pill>;
  if (s === "setup") return <Pill tone="accent">{serviceStatusLabel(s)}</Pill>;
  if (s === "paused") return <Pill tone="yellow">{serviceStatusLabel(s)}</Pill>;
  return <Pill tone="red">{serviceStatusLabel(s)}</Pill>;
}

type AccessInitial = {
  emailNotifyEnabled: boolean;
  mailConfigured: boolean;
  members: {
    id: string;
    userId: string;
    email: string;
    name: string | null;
    isBlocked: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }[];
  activeInvite: {
    id: string;
    email: string | null;
    expiresAt: string;
    createdAt: string;
  } | null;
  mailLogs: {
    id: string;
    kind: string;
    toEmail: string;
    subject: string;
    status: string;
    error: string | null;
    periodKey: string | null;
    createdAt: string;
  }[];
};

export function ClientDetail({
  client,
  initialAccess,
  chatApiReady,
  chatSsoReady,
  chatMissingKeys,
  totpEnabled = false,
}: {
  client: Client;
  initialAccess: AccessInitial;
  chatApiReady: boolean;
  chatSsoReady: boolean;
  chatMissingKeys: string[];
  totpEnabled?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(client.name);
  const [siteUrl, setSiteUrl] = useState(client.siteUrl ?? "");
  const [contact, setContact] = useState(client.contact ?? "");
  const [manualExternalId, setManualExternalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<number | null>(null);

  const chatLink = client.services.find((s) => s.service.slug === "chat");
  const canImpersonate =
    chatSsoReady && Boolean(chatLink?.externalId);

  function showToast(tone: "ok" | "err", text: string) {
    setToast({ tone, text });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2500);
  }

  async function refresh() {
    router.refresh();
  }

  async function saveMeta() {
    setBusy(true);
    setError(null);
    // Только карточка: срок ClientService этим запросом не трогаем.
    const res = await api<{ client: Client }>(`/api/clients/${client.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        siteUrl: siteUrl || null,
        contact: contact || null,
      }),
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    await refresh();
  }

  async function setStatus(status: Client["status"]) {
    setBusy(true);
    setError(null);
    const res = await api<{ client: Client }>(`/api/clients/${client.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    await refresh();
  }

  async function connectChat(opts?: { externalId?: string }) {
    setBusy(true);
    setError(null);
    const res = await api<{ clientService: Cs }>(
      `/api/clients/${client.id}/connect`,
      {
        method: "POST",
        body: JSON.stringify({
          serviceSlug: "chat",
          externalId: opts?.externalId || null,
        }),
      },
    );
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setManualExternalId("");
    await refresh();
  }

  async function retrySync(csId: string) {
    setBusy(true);
    setError(null);
    const res = await api(`/api/clients/services/${csId}/sync`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
            {client.name}
          </h2>
          {statusPill(client.status)}
          {client.deleteIncomplete ? (
            <Pill tone="red">удаление не завершено</Pill>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/clients">
            <Button variant="ghost">К списку</Button>
          </Link>
          <DeleteClientControls
            clientId={client.id}
            clientName={client.name}
            totpEnabled={totpEnabled}
            incomplete={Boolean(client.deleteIncomplete)}
            incompleteError={client.deleteIncompleteError}
            onError={setError}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-[10px] border border-[color-mix(in_srgb,var(--rd)_40%,var(--bd))] bg-[color-mix(in_srgb,var(--rd)_8%,transparent)] px-3 py-2 text-[13px] text-rd">
          {error}
          {error.includes("недоступен") || error.includes("не настроен") ? (
            <Button
              className="ml-3"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                chatLink
                  ? retrySync(chatLink.id)
                  : connectChat(
                      manualExternalId
                        ? { externalId: manualExternalId }
                        : undefined,
                    )
              }
            >
              Повторить
            </Button>
          ) : null}
        </div>
      ) : null}

      <ClientAccessPanel clientId={client.id} initial={initialAccess} />

      <Card>
        <CardHeader
          title="Карточка"
          subtitle="имя и контакты; срок работы — отдельно у сервиса"
        />
        <form
          className="grid-g2 max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            void saveMeta();
          }}
        >
          <Field label="Название" htmlFor="cname">
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div>
            <Field label="Статус клиента" htmlFor="cstatus">
              <Select
                id="cstatus"
                value={client.status}
                disabled={busy}
                onChange={(e) =>
                  setStatus(e.target.value as Client["status"])
                }
              >
                {(Object.keys(CLIENT_STATUS_LABEL) as ClientStatusCode[]).map(
                  (code) => (
                    <option key={code} value={code}>
                      {CLIENT_STATUS_LABEL[code]}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <p className="mt-1 text-[11.5px] text-mu">
              Общий статус клиента: влияет на все его сервисы (сохраняется сразу
              при выборе).
            </p>
          </div>
          <Field label="Сайт" htmlFor="csite">
            <Input
              id="csite"
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
            />
          </Field>
          <Field label="Контакт" htmlFor="ccontact">
            <Input
              id="ccontact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </Field>
          <div className="col-span-full flex gap-2">
            <Button type="submit" disabled={busy}>
              Сохранить
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Подключённые сервисы"
          subtitle="продукты; инфраструктура здесь не показывается"
        />

        {client.services.length === 0 ? (
          <p className="mb-4 text-[13px] text-mu">Пока ничего не подключено.</p>
        ) : (
          <ul className="mb-4 space-y-3">
            {client.services.map((cs) => (
              <li
                key={cs.id}
                className="rounded-[12px] border border-bd bg-bg2/40 px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-tx">
                      {cs.service.name}
                    </span>
                    {csPill(cs.status)}
                    {cs.lastSyncError ? (
                      <Pill tone="yellow">не синхронизировано</Pill>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cs.manageHref ? (
                      <a href={cs.manageHref} target="_blank" rel="noreferrer">
                        <Button variant="ghost">Настроить</Button>
                      </a>
                    ) : (
                      <Button variant="ghost" disabled title="Нужен externalId">
                        Настроить
                      </Button>
                    )}
                    {cs.lastSyncError ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => retrySync(cs.id)}
                      >
                        Повторить sync
                      </Button>
                    ) : null}
                    {cs.service.slug === "chat" ? (
                      <ImpersonateControls
                        clientId={client.id}
                        enabled={canImpersonate}
                        totpEnabled={totpEnabled}
                        onError={setError}
                      />
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-[12.5px] text-mu">
                  externalId:{" "}
                  <span className="font-semibold text-tx">
                    {cs.externalId || "—"}
                  </span>
                  {cs.lastSyncError ? (
                    <>
                      {" "}
                      · {cs.lastSyncError}
                    </>
                  ) : null}
                </p>
                <ConnectionStatusSelect
                  key={`${cs.id}:${cs.status}`}
                  clientServiceId={cs.id}
                  status={cs.status}
                  disabled={busy}
                  onToast={showToast}
                  onSaved={() => void refresh()}
                />
                {cs.service.slug === "chat" ? (
                  <ServicePeriodControls
                    key={`${cs.id}:${coerceYmd(cs.activeFrom)}:${coerceYmd(cs.activeUntil)}:${cs.paymentNote ?? ""}`}
                    clientServiceId={cs.id}
                    activeFrom={coerceYmd(cs.activeFrom)}
                    activeUntil={coerceYmd(cs.activeUntil)}
                    paymentNote={cs.paymentNote}
                    disabled={busy}
                    onSaved={() => void refresh()}
                    onError={setError}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {!chatLink ? (
          <div className="space-y-3 border-t border-bd pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <Button
                disabled={busy || (!chatApiReady && !manualExternalId.trim())}
                title={
                  !chatApiReady && !manualExternalId.trim()
                    ? `Нужны ключи: ${chatMissingKeys.join(", ")} или ручной externalId`
                    : undefined
                }
                onClick={() =>
                  connectChat(
                    manualExternalId.trim()
                      ? { externalId: manualExternalId.trim() }
                      : undefined,
                  )
                }
              >
                Подключить Чат
              </Button>
              <Field label="externalId вручную (запасной)" htmlFor="extid">
                <Input
                  id="extid"
                  value={manualExternalId}
                  onChange={(e) => setManualExternalId(e.target.value)}
                  placeholder="если API чата недоступен"
                  className="max-w-xs"
                />
              </Field>
            </div>
            {!chatApiReady ? (
              <p className="text-[12.5px] text-mu">
                Автоподключение выключено. Задайте в .env:{" "}
                {chatMissingKeys.join(", ")}. Либо укажите externalId вручную.
              </p>
            ) : null}
          </div>
        ) : null}

        {chatLink ? (
          <div className="mt-4 space-y-2 border-t border-bd pt-4">
            <p className="text-[12.5px] text-mu">
              «Войти как клиент» — кнопка у сервиса выше. Если пароль вводили
              меньше 15 минут назад, переход сразу; иначе спросим пароль.
              Cookie хаба не подменяется.
            </p>
            {!chatSsoReady ? (
              <p className="text-[12.5px] text-mu">
                SSO выключен: задайте CHAT_BASE_URL и HUB_CHAT_SSO_SECRET.
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>
      <Toast toast={toast} />
    </div>
  );
}
