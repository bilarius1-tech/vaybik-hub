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

type Meta = {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  username: string | null;
  folder: string | null;
  tags: string[];
  note: string | null;
  keyVersion: number;
  updatedAt: string;
};

export function VaultPanel({ initial }: { initial: Meta[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("login");
  const [username, setUsername] = useState("");
  const [folder, setFolder] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthCode, setReauthCode] = useState("");
  const [revealed, setRevealed] = useState<Record<string, unknown> | null>(null);
  const [revealTitle, setRevealTitle] = useState("");
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
    setErr(null);
    return true;
  }

  async function create() {
    setErr(null);
    const secrets: Record<string, string> = {};
    if (password) secrets.password = password;
    if (token) secrets.token = token;
    const tags = tagsRaw
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await api("/api/vault", {
      method: "POST",
      body: JSON.stringify({
        title,
        kind,
        username: username || null,
        folder: folder || null,
        tags,
        secrets,
      }),
    });
    if (res.error) setErr(res.error.message);
    else {
      setMsg("Запись создана");
      setTitle("");
      setPassword("");
      setToken("");
      router.refresh();
    }
  }

  async function genPass() {
    const res = await api<{ password: string }>("/api/vault/generate-password", {
      method: "POST",
      body: "{}",
    });
    if (res.data) setPassword(res.data.password);
  }

  async function reveal(id: string, t: string) {
    setErr(null);
    setRevealed(null);
    const ok = await doReauth();
    if (!ok) return;
    const res = await api<{ secrets: Record<string, unknown>; autoClearMs: number }>(
      `/api/vault/${id}/reveal`,
      { method: "POST", body: "{}" },
    );
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setRevealTitle(t);
    setRevealed(res.data?.secrets || {});
    const clearMs = res.data?.autoClearMs ?? 30_000;
    window.setTimeout(() => setRevealed(null), clearMs);
  }

  async function copyValue(text: string) {
    await navigator.clipboard.writeText(text);
    setMsg("Скопировано — буфер очистится через 30 с");
    window.setTimeout(() => {
      void navigator.clipboard.writeText("").catch(() => undefined);
    }, 30_000);
  }

  return (
    <div className="space-y-6">
      <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">Доступы</h2>

      <Card>
        <CardHeader
          title="Повторная аутентификация"
          subtitle="нужна для раскрытия секретов"
        />
        <div className="grid-g2">
          <Field label="Пароль" htmlFor="vp">
            <Input
              id="vp"
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
            />
          </Field>
          <Field label="TOTP" htmlFor="vc">
            <Input
              id="vc"
              value={reauthCode}
              onChange={(e) => setReauthCode(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Новая запись" />
        <div className="grid-g2">
          <Field label="Название" htmlFor="t">
            <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Тип" htmlFor="k">
            <Select id="k" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="login">login</option>
              <option value="api_key">api_key</option>
              <option value="telegram_bot">telegram_bot</option>
              <option value="note">note</option>
              <option value="db">db</option>
              <option value="ssh">ssh</option>
            </Select>
          </Field>
          <Field label="Логин" htmlFor="u">
            <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Папка" htmlFor="f">
            <Input id="f" value={folder} onChange={(e) => setFolder(e.target.value)} />
          </Field>
          <Field label="Теги (через запятую)" htmlFor="tags">
            <Input
              id="tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
            />
          </Field>
          <Field label="Пароль / секрет" htmlFor="p">
            <Input
              id="p"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Token (для telegram_bot / api)" htmlFor="tok">
            <Input
              id="tok"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => void genPass()}>
            Сгенерировать пароль
          </Button>
          <Button onClick={() => void create()}>Сохранить</Button>
        </div>
        {msg ? <p className="mt-2 text-[13px] text-gr">{msg}</p> : null}
        {err ? <p className="mt-2 text-[13px] text-rd">{err}</p> : null}
      </Card>

      {revealed ? (
        <Card>
          <CardHeader title={`Секреты: ${revealTitle}`} subtitle="автоочистка через 30 с" />
          <ul className="space-y-2 text-[13px]">
            {Object.entries(revealed).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-2">
                <span className="text-mu">{k}</span>
                <code className="rounded bg-bg2 px-2 py-1">{String(v)}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void copyValue(String(v))}
                >
                  Копировать
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Список" subtitle="без секретных полей" />
        <DataTable
          rows={initial}
          rowKey={(r) => r.id}
          columns={[
            { key: "t", header: "Название", render: (r) => r.title },
            {
              key: "k",
              header: "Тип",
              render: (r) => <Pill tone="accent">{r.kind}</Pill>,
            },
            { key: "f", header: "Папка", render: (r) => r.folder || "—" },
            {
              key: "tags",
              header: "Теги",
              render: (r) =>
                r.tags.length ? r.tags.join(", ") : "—",
            },
            { key: "u", header: "Логин", render: (r) => r.username || "—" },
            {
              key: "upd",
              header: "Обновлено",
              render: (r) => formatDateTime(r.updatedAt),
            },
            {
              key: "a",
              header: "",
              render: (r) => (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void reveal(r.id, r.title)}
                >
                  Показать
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
