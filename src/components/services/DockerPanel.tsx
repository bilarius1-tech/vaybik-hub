"use client";

import { LogViewer } from "@/components/services/LogViewer";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";

type ContainerRow = {
  name: string;
  id?: string;
  image?: string;
  state?: string;
  running?: boolean;
  uptimeSec?: number;
  cpuPercent?: number;
  memUsage?: number;
  memLimit?: number;
  error?: string;
};

function fmtBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

function fmtUptime(sec: number): string {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 48) return `${Math.floor(h / 24)} д ${h % 24} ч`;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

type Props = {
  serviceId: string;
  containerNames: string[];
};

export function DockerPanel({ serviceId, containerNames }: Props) {
  const [rows, setRows] = useState<ContainerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    containerNames[0] || null,
  );
  const [confirm, setConfirm] = useState<{
    action: "restart" | "start" | "stop" | "update";
    name: string;
  } | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthCode, setReauthCode] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    const res = await api<{ containers: ContainerRow[] }>(
      `/api/services/${serviceId}/docker`,
    );
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setRows(res.data?.containers || []);
  }, [serviceId]);

  useEffect(() => {
    if (!containerNames.length) return;
    // Загрузка статуса с Docker API при открытии карточки
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
    void load();
  }, [containerNames.length, load]);

  async function doReauthIfNeeded(action: string) {
    if (action !== "stop" && action !== "update") return true;
    const res = await api("/api/auth/reauth", {
      method: "POST",
      body: JSON.stringify({
        password: reauthPassword,
        code: reauthCode || undefined,
      }),
    });
    if (res.error) {
      setErr(res.error.message);
      return false;
    }
    return true;
  }

  async function runAction() {
    if (!confirm) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const ok = await doReauthIfNeeded(confirm.action);
    if (!ok) {
      setBusy(false);
      return;
    }
    const res = await api(
      `/api/services/${serviceId}/docker/${encodeURIComponent(confirm.name)}/action`,
      {
        method: "POST",
        body: JSON.stringify({ action: confirm.action }),
      },
    );
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg(`Готово: ${confirm.action} → ${confirm.name}`);
    setConfirm(null);
    setReauthPassword("");
    setReauthCode("");
    await load();
  }

  if (!containerNames.length) {
    return (
      <Card>
        <CardHeader
          title="Docker"
          subtitle="укажите имена контейнеров в карточке сервиса"
        />
        <p className="text-[13px] text-mu">
          Добавьте имена в поле «Контейнеры» и label{" "}
          <code className="text-ac">vaybik.managed=true</code> в compose сервиса.
        </p>
      </Card>
    );
  }

  const needsReauth =
    confirm?.action === "stop" || confirm?.action === "update";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Docker"
          subtitle="управление через socket-proxy"
          action={
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Обновить
            </Button>
          }
        />
        {msg ? <p className="mb-2 text-[13px] text-gr">{msg}</p> : null}
        {err ? <p className="mb-2 text-[13px] text-rd">{err}</p> : null}
        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.name}
              className={`rounded-xl border p-3 ${
                selected === r.name ? "border-ac" : "border-bd"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setSelected(r.name)}
                >
                  <div className="text-[13.5px] font-bold text-tx">{r.name}</div>
                  <div className="text-[12px] text-mu">{r.image || r.error || "—"}</div>
                </button>
                <Pill tone={r.running ? "green" : "yellow"}>
                  {r.state || "unknown"}
                </Pill>
              </div>
              {!r.error ? (
                <dl className="mt-2 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-4">
                  <div>
                    <dt className="text-mu">Uptime</dt>
                    <dd>{fmtUptime(r.uptimeSec || 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-mu">CPU</dt>
                    <dd>{r.cpuPercent != null ? `${r.cpuPercent}%` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-mu">RAM</dt>
                    <dd>
                      {fmtBytes(r.memUsage || 0)} / {fmtBytes(r.memLimit || 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-mu">ID</dt>
                    <dd className="font-mono">{r.id || "—"}</dd>
                  </div>
                </dl>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm({ action: "restart", name: r.name })}
                >
                  Restart
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || !!r.running}
                  onClick={() => setConfirm({ action: "start", name: r.name })}
                >
                  Start
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy || !r.running}
                  onClick={() => setConfirm({ action: "stop", name: r.name })}
                >
                  Stop
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm({ action: "update", name: r.name })}
                >
                  Обновить образ
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {selected ? (
        <Card>
          <CardHeader title={`Логи: ${selected}`} />
          <LogViewer serviceId={serviceId} containerName={selected} />
        </Card>
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm
            ? `${confirm.action.toUpperCase()}: ${confirm.name}`
            : ""
        }
        danger={confirm?.action === "stop"}
        busy={busy}
        confirmLabel="Выполнить"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runAction()}
      >
        {confirm?.action === "update" ? (
          <p>
            Будет выполнен pull образа и пересоздание контейнера с теми же
            параметрами (вариант A).
          </p>
        ) : (
          <p>Действие применится к контейнеру на сервере.</p>
        )}
        {needsReauth ? (
          <div className="mt-3 grid gap-2">
            <Field label="Пароль (повторный вход)" htmlFor="dr-p">
              <Input
                id="dr-p"
                type="password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
              />
            </Field>
            <Field label="TOTP (если включён)" htmlFor="dr-c">
              <Input
                id="dr-c"
                value={reauthCode}
                onChange={(e) => setReauthCode(e.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
