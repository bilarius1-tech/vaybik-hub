"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SessionRow = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  current?: boolean;
};

type Props = {
  email: string;
  name: string | null;
  role: string;
  totpEnabled: boolean;
  initialSessions: SessionRow[];
};

export function ProfilePanel({ email, name, role, totpEnabled, initialSessions }: Props) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const res = await api<{ reLogin?: boolean }>("/api/profile/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Пароль изменён — войдите снова");
    router.push("/login");
    router.refresh();
  }

  async function revoke(sessionId: string) {
    const res = await api("/api/sessions", {
      method: "DELETE",
      body: JSON.stringify({ sessionId }),
    });
    if (!res.error) router.refresh();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-tx mt-[10px] mb-3 text-[16.5px] font-extrabold">Профиль</h2>
      <Card>
        <CardHeader title={name || email} subtitle={email} />
        <div className="flex flex-wrap gap-2">
          <Pill tone="accent">{role}</Pill>
          <Pill tone={totpEnabled ? "green" : "yellow"}>
            2FA: {totpEnabled ? "вкл" : "выкл"}
          </Pill>
        </div>
        {!totpEnabled ? (
          <p className="mt-3 text-[13px]">
            <Link href="/setup-2fa" className="text-ac font-semibold underline">
              Включить вход по коду из приложения (2FA)
            </Link>
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Смена пароля" subtitle="завершит все сессии" />
        <form onSubmit={(e) => void changePassword(e)}>
          <Field label="Текущий пароль" htmlFor="cur">
            <Input
              id="cur"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
          <Field label="Новый пароль (≥ 12)" htmlFor="neu">
            <Input
              id="neu"
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          {err ? <p className="text-rd mt-2 text-[13px]">{err}</p> : null}
          {msg ? <p className="text-gr mt-2 text-[13px]">{msg}</p> : null}
          <div className="mt-4">
            <Button type="submit">Сменить пароль</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Активные сессии" />
        <DataTable
          rows={initialSessions}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "ip",
              header: "IP",
              render: (r) => (
                <span>
                  {r.ip || "—"} {r.current ? <Pill tone="accent">эта</Pill> : null}
                </span>
              ),
            },
            {
              key: "ua",
              header: "Клиент",
              render: (r) => (
                <span className="text-mu line-clamp-1 max-w-[280px]">
                  {r.userAgent || "—"}
                </span>
              ),
            },
            {
              key: "created",
              header: "Создана",
              render: (r) => formatDateTime(r.createdAt),
            },
            {
              key: "act",
              header: "",
              render: (r) =>
                r.current ? null : (
                  <Button size="sm" variant="ghost" onClick={() => void revoke(r.id)}>
                    Завершить
                  </Button>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
