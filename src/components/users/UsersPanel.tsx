"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  totpEnabled: boolean;
  isBlocked: boolean;
  lastLoginAt: string | null;
  _count: { sessions: number };
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  usedAt: string | null;
};

type Props = {
  initialUsers: UserRow[];
  initialInvites: InviteRow[];
  /** Без 2FA повторная аутентификация — только паролем */
  totpEnabled?: boolean;
};

export function UsersPanel({ initialUsers, initialInvites, totpEnabled = true }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthCode, setReauthCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function doReauth() {
    const res = await api("/api/auth/reauth", {
      method: "POST",
      body: JSON.stringify({ password: reauthPassword, code: reauthCode }),
    });
    if (res.error) {
      setErr(res.error.message);
      return false;
    }
    setMsg("Повторная аутентификация OK (5 мин)");
    setErr(null);
    return true;
  }

  async function createInvite() {
    setErr(null);
    const ok = await doReauth();
    if (!ok) return;
    const res = await api<{ acceptUrl: string }>("/api/invites", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setInviteLink(res.data?.acceptUrl ?? null);
    setEmail("");
    router.refresh();
  }

  async function toggleBlock(userId: string, isBlocked: boolean) {
    setErr(null);
    const ok = await doReauth();
    if (!ok) return;
    const res = await api("/api/users", {
      method: "PATCH",
      body: JSON.stringify({ userId, isBlocked }),
    });
    if (res.error) setErr(res.error.message);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-tx mt-[10px] mb-3 text-[16.5px] font-extrabold">
        Пользователи
      </h2>

      <Card>
        <CardHeader
          title="Повторная аутентификация"
          subtitle="нужна для приглашений и блокировок"
        />
        <div className="grid-g2">
          <Field label="Пароль" htmlFor="rp">
            <Input
              id="rp"
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
            />
          </Field>
          {totpEnabled ? (
            <Field label="TOTP" htmlFor="rc">
              <Input
                id="rc"
                value={reauthCode}
                onChange={(e) => setReauthCode(e.target.value)}
              />
            </Field>
          ) : null}
        </div>
        {msg ? <p className="text-gr mt-2 text-[13px]">{msg}</p> : null}
        {err ? <p className="text-rd mt-2 text-[13px]">{err}</p> : null}
      </Card>

      <Card>
        <CardHeader title="Пригласить" subtitle="ссылка действует 48 часов" />
        <div className="grid-g3 items-end">
          <Field label="Email" htmlFor="inv-email">
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Роль" htmlFor="inv-role">
            <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ADMIN">ADMIN</option>
              <option value="PARTNER">PARTNER</option>
              <option value="OWNER">OWNER</option>
            </Select>
          </Field>
          <Button onClick={() => void createInvite()}>Создать ссылку</Button>
        </div>
        {inviteLink ? (
          <p className="text-ac mt-3 text-[12.5px] break-all">{inviteLink}</p>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Список" />
        <DataTable
          rows={initialUsers}
          rowKey={(r) => r.id}
          columns={[
            { key: "email", header: "Email", render: (r) => r.email },
            { key: "role", header: "Роль", render: (r) => r.role },
            {
              key: "2fa",
              header: "2FA",
              render: (r) => (
                <Pill tone={r.totpEnabled ? "green" : "yellow"}>
                  {r.totpEnabled ? "да" : "нет"}
                </Pill>
              ),
            },
            {
              key: "status",
              header: "Статус",
              render: (r) => (
                <Pill tone={r.isBlocked ? "red" : "green"}>
                  {r.isBlocked ? "блок" : "активен"}
                </Pill>
              ),
            },
            {
              key: "login",
              header: "Вход",
              render: (r) => (r.lastLoginAt ? formatDateTime(r.lastLoginAt) : "—"),
            },
            {
              key: "actions",
              header: "",
              render: (r) => (
                <Button
                  size="sm"
                  variant={r.isBlocked ? "ghost" : "danger"}
                  onClick={() => void toggleBlock(r.id, !r.isBlocked)}
                >
                  {r.isBlocked ? "Разблок." : "Блок"}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Приглашения" />
        <DataTable
          rows={initialInvites}
          rowKey={(r) => r.id}
          columns={[
            { key: "email", header: "Email", render: (r) => r.email },
            { key: "role", header: "Роль", render: (r) => r.role },
            {
              key: "exp",
              header: "Истекает",
              render: (r) => formatDateTime(r.expiresAt),
            },
            {
              key: "used",
              header: "Статус",
              render: (r) => (r.usedAt ? "использовано" : "ожидает"),
            },
          ]}
        />
      </Card>
    </div>
  );
}
