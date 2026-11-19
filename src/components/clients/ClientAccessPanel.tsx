"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api-client";
import { useState } from "react";

type Member = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  isBlocked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type ActiveInvite = {
  id: string;
  email: string | null;
  expiresAt: string;
  createdAt: string;
};

type MailLog = {
  id: string;
  kind: string;
  toEmail: string;
  subject: string;
  status: string;
  error: string | null;
  periodKey: string | null;
  createdAt: string;
};

type Initial = {
  emailNotifyEnabled: boolean;
  mailConfigured: boolean;
  members: Member[];
  activeInvite: ActiveInvite | null;
  mailLogs: MailLog[];
};

const KIND_LABEL: Record<string, string> = {
  invite: "приглашение",
  expiry_7: "срок −7 дн.",
  expiry_1: "срок −1 дн.",
  expired: "срок истёк",
  test: "тест",
};

export function ClientAccessPanel({
  clientId,
  initial,
}: {
  clientId: string;
  initial: Initial;
}) {
  const [members, setMembers] = useState(initial.members);
  const [activeInvite, setActiveInvite] = useState(initial.activeInvite);
  const [emailNotify, setEmailNotify] = useState(initial.emailNotifyEnabled);
  const [mailConfigured] = useState(initial.mailConfigured);
  const [mailLogs, setMailLogs] = useState(initial.mailLogs);
  const [email, setEmail] = useState("");
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function reload() {
    const res = await api<Initial>(`/api/clients/${clientId}/access`);
    if (res.error || !res.data) {
      setError(res.error?.message || "Не удалось загрузить доступ");
      return;
    }
    setMembers(res.data.members);
    setActiveInvite(res.data.activeInvite);
    setEmailNotify(res.data.emailNotifyEnabled);
    setMailLogs(res.data.mailLogs);
  }

  async function createInvite() {
    setBusy(true);
    setError(null);
    setMsg(null);
    setCopied(false);
    const res = await api<{
      acceptUrl: string;
      email: string | null;
      expiresAt: string;
      inviteId: string;
    }>(`/api/clients/${clientId}/access`, {
      method: "POST",
      body: JSON.stringify({ email: email.trim() || null }),
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message || "Не удалось создать приглашение");
      return;
    }
    setAcceptUrl(res.data.acceptUrl);
    await reload();
  }

  async function revokeInvite() {
    if (!activeInvite) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await api(`/api/clients/${clientId}/access`, {
      method: "DELETE",
      body: JSON.stringify({ inviteId: activeInvite.id }),
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setAcceptUrl(null);
    await reload();
  }

  async function copyLink() {
    if (!acceptUrl) return;
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopied(true);
    } catch {
      setError("Не удалось скопировать — скопируйте вручную");
    }
  }

  async function toggleNotify(next: boolean) {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await api(`/api/clients/${clientId}/access`, {
      method: "PATCH",
      body: JSON.stringify({ emailNotifyEnabled: next }),
    });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setEmailNotify(next);
  }

  async function sendInviteMail() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await api<{
      sent: boolean;
      to: string;
      acceptUrl: string;
    }>(`/api/clients/${clientId}/access/mail`, {
      method: "POST",
      body: JSON.stringify({
        action: "invite",
        email: email.trim() || null,
      }),
    });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message || "Не удалось отправить");
      return;
    }
    setAcceptUrl(res.data.acceptUrl);
    setMsg(`Приглашение отправлено на ${res.data.to}`);
    await reload();
  }

  async function sendTestMail() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await api<{ sent: boolean; to: string }>(
      `/api/clients/${clientId}/access/mail`,
      {
        method: "POST",
        body: JSON.stringify({ action: "test" }),
      },
    );
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message || "Не удалось отправить тест");
      return;
    }
    setMsg(`Тестовое письмо отправлено на ${res.data.to}`);
    await reload();
  }

  return (
    <Card>
      <CardHeader
        title="Доступ клиента"
        subtitle="приглашение 72 ч · клиент сам задаёт пароль · сброс = перевыпуск"
      />
      <div className="space-y-4 max-w-2xl">
        {members.length === 0 ? (
          <p className="text-[13px] text-mu">Пользователь клиента ещё не создан.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-2 text-[13px]"
              >
                <span className="font-semibold text-tx">{m.email}</span>
                {m.name ? <span className="text-mu">({m.name})</span> : null}
                {m.isBlocked ? (
                  <Pill tone="red">блок</Pill>
                ) : (
                  <Pill tone="green">CLIENT</Pill>
                )}
              </li>
            ))}
          </ul>
        )}

        {activeInvite ? (
          <div className="rounded-[10px] border border-bd bg-bg2 px-3 py-2 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">активное приглашение</Pill>
              <span className="text-mu">
                до {new Date(activeInvite.expiresAt).toLocaleString("ru-RU")}
              </span>
              {activeInvite.email ? (
                <span className="text-tx">{activeInvite.email}</span>
              ) : (
                <span className="text-mu">email задаст клиент</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void revokeInvite()}
              >
                Отозвать
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Email (необязательно)" htmlFor="client-invite-email">
            <Input
              id="client-invite-email"
              type="email"
              placeholder="если почта не настроена — оставьте пустым"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button disabled={busy} onClick={() => void createInvite()}>
            {activeInvite || members.length
              ? "Перевыпустить приглашение"
              : "Создать приглашение"}
          </Button>
        </div>

        {acceptUrl ? (
          <div className="rounded-[10px] border border-[color-mix(in_srgb,var(--ac)_30%,var(--bd))] bg-[color-mix(in_srgb,var(--ac)_6%,transparent)] px-3 py-2">
            <p className="break-all text-[12.5px] text-tx">{acceptUrl}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => void copyLink()}>
                {copied ? "Скопировано" : "Скопировать"}
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-mu">
              Ссылка одноразовая, 72 часа. Пароль клиент задаёт сам — мы его не
              видим и не назначаем.
            </p>
          </div>
        ) : null}

        <div className="rounded-[10px] border border-bd bg-bg2 px-3 py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-tx">Почта</span>
            {mailConfigured ? (
              <Pill tone="green">SMTP ок</Pill>
            ) : (
              <Pill tone="yellow">SMTP не настроен</Pill>
            )}
          </div>
          <label className="flex items-start gap-2 text-[13px] text-tx cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={emailNotify}
              disabled={busy}
              onChange={(e) => void toggleNotify(e.target.checked)}
            />
            <span>
              Отправлять письма клиенту
              <span className="block text-[12px] text-mu mt-0.5">
                срок за 7 и за 1 день, истечение утром следующего дня (MSK).
                Без галочки и без SMTP — только ручная ссылка.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !mailConfigured}
              onClick={() => void sendInviteMail()}
              title={
                mailConfigured
                  ? undefined
                  : "Сначала задайте SMTP_* в .env"
              }
            >
              Отправить приглашение на почту
            </Button>
            <Button
              variant="ghost"
              disabled={busy || !mailConfigured}
              onClick={() => void sendTestMail()}
            >
              Тестовое письмо мне
            </Button>
          </div>
          {!mailConfigured ? (
            <p className="text-[12px] text-mu">
              Пока SMTP нет — копируйте ссылку приглашения вручную. Секреты:
              SMTP_HOST/USER/PASS, MAIL_FROM.
            </p>
          ) : null}

          {mailLogs.length > 0 ? (
            <div>
              <p className="text-[12px] font-semibold text-mu mb-1">
                Журнал писем
              </p>
              <ul className="max-h-40 overflow-auto space-y-1 text-[12px]">
                {mailLogs.map((l) => (
                  <li key={l.id} className="flex flex-wrap gap-x-2 text-tx">
                    <span className="text-mu">
                      {new Date(l.createdAt).toLocaleString("ru-RU")}
                    </span>
                    <span>{KIND_LABEL[l.kind] || l.kind}</span>
                    <span className="text-mu">→ {l.toEmail}</span>
                    {l.status === "sent" ? (
                      <Pill tone="green">ok</Pill>
                    ) : (
                      <Pill tone="red">ошибка</Pill>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {msg ? (
          <p className="text-[13px] font-semibold text-[color:var(--gn,#2f9e44)]">
            {msg}
          </p>
        ) : null}
        {error ? (
          <p className="text-[13px] font-semibold text-rd">{error}</p>
        ) : null}
      </div>
    </Card>
  );
}
