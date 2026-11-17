"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { api } from "@/lib/api-client";

type VaultItem = { id: string; title: string; kind: string };

export function AddConnectionForm({ onCreated }: { onCreated: () => void }) {
  const [secrets, setSecrets] = useState<VaultItem[]>([]);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [secretId, setSecretId] = useState("");
  const [schedule, setSchedule] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await api<{ secrets: VaultItem[] }>("/api/vault");
      if (res.data?.secrets) {
        setSecrets(res.data.secrets.filter((s) => s.kind === "db"));
      }
    })();
  }, []);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await api("/api/databases", {
      method: "POST",
      body: JSON.stringify({
        name,
        host,
        port: Number(port),
        database,
        secretId,
        backupSchedule: schedule || null,
        engine: "postgres",
      }),
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setName("");
    setHost("");
    setDatabase("");
    setSecretId("");
    setSchedule("");
    onCreated();
  }

  return (
    <Card>
      <CardHeader
        title="Добавить Postgres"
        subtitle="пароль только из Vault (kind=db). Region и чужие проекты — не добавлять."
      />
      {err ? (
        <p className="mb-2 text-[13px] text-rd" role="alert">
          {err}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-[12.5px]">
          Имя
          <input
            className="mt-1 w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-[12.5px]">
          Хост
          <input
            className="mt-1 w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
        </label>
        <label className="text-[12.5px]">
          Порт
          <input
            className="mt-1 w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </label>
        <label className="text-[12.5px]">
          База
          <input
            className="mt-1 w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
          />
        </label>
        <label className="text-[12.5px] md:col-span-2">
          Vault (kind=db)
          <select
            className="mt-1 w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
            value={secretId}
            onChange={(e) => setSecretId(e.target.value)}
          >
            <option value="">— выберите —</option>
            {secrets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12.5px] md:col-span-2">
          Расписание бэкапа (cron, Europe/Moscow), опционально
          <input
            className="mt-1 w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
            placeholder="0 4 * * *"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-3">
        <Button
          onClick={() => void submit()}
          disabled={busy || !name || !host || !database || !secretId}
        >
          Добавить
        </Button>
      </div>
    </Card>
  );
}
