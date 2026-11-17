"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api-client";

type Props = {
  id: string;
  isOwner: boolean;
  canRestore: boolean;
};

type Conn = {
  id: string;
  name: string;
  slug: string;
  host: string;
  port: number;
  database: string;
  engine: string;
  isSystem: boolean;
  lastSizeBytes: string | null;
  lastTableCount: number | null;
  lastPgVersion: string | null;
  backups: Array<{
    id: string;
    status: string;
    target: string;
    trigger: string;
    file: string;
    sizeBytes: string | null;
    startedAt: string;
    error: string | null;
  }>;
};

type TableInfo = {
  schema: string;
  name: string;
  approxRows: number | null;
  sizeBytes: number | null;
};

function fmtBytes(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

export function DatabaseDetail({ id, isOwner, canRestore }: Props) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [sql, setSql] = useState("SELECT 1");
  const [queryRows, setQueryRows] = useState<Record<string, unknown>[]>([]);
  const [queryCols, setQueryCols] = useState<string[]>([]);

  const [reauthPassword, setReauthPassword] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api<{
      connection: Conn;
      inspect: { tables?: TableInfo[]; error?: string } | null;
    }>(`/api/databases/${id}`);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setConn(res.data!.connection);
    if (res.data?.inspect && "tables" in res.data.inspect && res.data.inspect.tables) {
      setTables(res.data.inspect.tables);
    } else if (res.data?.inspect && "error" in res.data.inspect) {
      setErr(String(res.data.inspect.error));
    }
  }, [id]);

  useEffect(() => {
    // Загрузка карточки БД
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
    void load();
  }, [load]);

  async function openTable(schema: string, name: string, p = 1) {
    setBusy(true);
    setErr(null);
    setActiveTable(`${schema}.${name}`);
    setPage(p);
    const q = new URLSearchParams({
      schema,
      page: String(p),
      pageSize: "50",
    });
    if (filter) q.set("filter", filter);
    const res = await api<{
      columns: string[];
      rows: Record<string, unknown>[];
      total: number;
    }>(`/api/databases/${id}/tables/${encodeURIComponent(name)}?${q}`);
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setColumns(res.data!.columns);
    setRows(res.data!.rows);
    setTotal(res.data!.total);
  }

  async function runBackup() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const res = await api<{ file?: string }>(`/api/databases/${id}/backup`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg(`Бэкап готов: ${res.data?.file ?? "ok"}`);
    await load();
  }

  async function runQuery() {
    if (!isOwner) return;
    setBusy(true);
    setErr(null);
    const res = await api<{
      columns: string[];
      rows: Record<string, unknown>[];
      truncated: boolean;
    }>(`/api/databases/${id}/query`, {
      method: "POST",
      body: JSON.stringify({ sql }),
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setQueryCols(res.data!.columns);
    setQueryRows(res.data!.rows);
    if (res.data!.truncated) setMsg("Показаны первые 500 строк");
  }

  async function doReauth(): Promise<boolean> {
    const res = await api("/api/auth/reauth", {
      method: "POST",
      body: JSON.stringify({ password: reauthPassword }),
    });
    if (res.error) {
      setErr(res.error.message);
      return false;
    }
    return true;
  }

  async function confirmDownload() {
    if (!downloadId) return;
    setBusy(true);
    const ok = await doReauth();
    if (!ok) {
      setBusy(false);
      return;
    }
    // Скачивание через fetch с cookies
    const res = await fetch(`/admin/api/backups/${downloadId}/download`, {
      credentials: "same-origin",
      headers: { Accept: "application/octet-stream" },
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setErr(body?.error?.message || `Ошибка ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const m = /filename="([^"]+)"/.exec(cd);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = m?.[1] || "backup.dump.enc";
    a.click();
    URL.revokeObjectURL(a.href);
    setDownloadId(null);
    setReauthPassword("");
    setMsg("Файл скачан (.enc)");
  }

  async function confirmRestore() {
    if (!restoreId || !conn) return;
    setBusy(true);
    const ok = await doReauth();
    if (!ok) {
      setBusy(false);
      return;
    }
    const res = await api<{ detail?: string }>(
      `/api/backups/${restoreId}/restore`,
      {
        method: "POST",
        body: JSON.stringify({ confirmName, target: "test" }),
      },
    );
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg(`Тестовый restore OK: ${res.data?.detail ?? ""}`);
    setRestoreId(null);
    setConfirmName("");
    setReauthPassword("");
    await load();
  }

  if (!conn) {
    return <p className="text-[13px] text-mu">{err || "Загрузка…"}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/databases" className="text-[12.5px] text-mu hover:text-ac">
            ← Базы данных
          </Link>
          <h2 className="mt-1 text-[16.5px] font-extrabold text-tx">
            {conn.name}
          </h2>
          <p className="text-[12.5px] text-mu">
            {conn.engine} · {conn.host}:{conn.port} / {conn.database}
            {conn.lastPgVersion ? ` · ${conn.lastPgVersion}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void runBackup()} disabled={busy}>
            Сделать бэкап
          </Button>
          <Button variant="ghost" onClick={() => void load()} disabled={busy}>
            Обновить
          </Button>
        </div>
      </div>

      {err ? (
        <p className="text-[13px] text-danger" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? <p className="text-[13px] text-gr">{msg}</p> : null}

      <div className="grid gap-[14px] md:grid-cols-3">
        <Card>
          <CardHeader title="Размер" />
          <p className="text-[28px] font-extrabold tabular-nums">
            {fmtBytes(conn.lastSizeBytes)}
          </p>
        </Card>
        <Card>
          <CardHeader title="Таблиц" />
          <p className="text-[28px] font-extrabold tabular-nums">
            {conn.lastTableCount?.toLocaleString("ru-RU") ?? "—"}
          </p>
        </Card>
        <Card>
          <CardHeader title="Последний бэкап" />
          <p className="text-[14px] font-bold">
            {conn.backups[0] ? (
              <Pill
                tone={
                  conn.backups[0].status === "error"
                    ? "red"
                    : conn.backups[0].status === "ok" ||
                        conn.backups[0].status === "verified"
                      ? "green"
                      : "yellow"
                }
              >
                {conn.backups[0].status}
              </Pill>
            ) : (
              "—"
            )}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Таблицы" subtitle="read-only браузер" />
        <DataTable
          rows={tables}
          rowKey={(t) => `${t.schema}.${t.name}`}
          columns={[
            {
              key: "name",
              header: "Таблица",
              render: (t) => (
                <button
                  type="button"
                  className="font-semibold hover:text-ac"
                  onClick={() => void openTable(t.schema, t.name)}
                >
                  {t.schema}.{t.name}
                </button>
              ),
            },
            {
              key: "rows",
              header: "~строк",
              render: (t) =>
                t.approxRows != null
                  ? Math.max(0, Math.round(t.approxRows)).toLocaleString("ru-RU")
                  : "—",
            },
            {
              key: "size",
              header: "Размер",
              render: (t) => fmtBytes(t.sizeBytes),
            },
          ]}
        />
      </Card>

      {activeTable ? (
        <Card>
          <CardHeader
            title={activeTable}
            subtitle="пагинация и простой фильтр по текстовым колонкам"
          />
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              className="rounded-[10px] border border-bd bg-card2 px-3 py-2 text-[13px]"
              placeholder="Фильтр…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                const [schema, name] = activeTable.split(".") as [string, string];
                void openTable(schema, name, 1);
              }}
            >
              Применить
            </Button>
            <span className="self-center text-[12.5px] text-mu">
              Всего: {total.toLocaleString("ru-RU")} · стр. {page}
            </span>
            <Button
              variant="ghost"
              disabled={busy || page <= 1}
              onClick={() => {
                const [schema, name] = activeTable.split(".") as [string, string];
                void openTable(schema, name, page - 1);
              }}
            >
              ←
            </Button>
            <Button
              variant="ghost"
              disabled={busy || page * 50 >= total}
              onClick={() => {
                const [schema, name] = activeTable.split(".") as [string, string];
                void openTable(schema, name, page + 1);
              }}
            >
              →
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px] tabular-nums">
              <thead>
                <tr className="border-b border-bd text-mu">
                  {columns.map((c) => (
                    <th key={c} className="px-2 py-1 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-bd/50">
                    {columns.map((c) => (
                      <td key={c} className="max-w-[220px] truncate px-2 py-1">
                        {formatCell(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {isOwner ? (
        <Card>
          <CardHeader
            title="SELECT-консоль"
            subtitle="только OWNER · timeout 5 с · лимит 500 строк · мутации запрещены"
          />
          <textarea
            className="min-h-[100px] w-full rounded-[10px] border border-bd bg-card2 p-3 font-mono text-[12.5px]"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
          />
          <div className="mt-2">
            <Button onClick={() => void runQuery()} disabled={busy}>
              Выполнить
            </Button>
          </div>
          {queryCols.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-bd text-mu">
                    {queryCols.map((c) => (
                      <th key={c} className="px-2 py-1">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryRows.map((r, i) => (
                    <tr key={i} className="border-b border-bd/50">
                      {queryCols.map((c) => (
                        <td key={c} className="max-w-[220px] truncate px-2 py-1">
                          {formatCell(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Бэкапы"
          subtitle="скачивание .enc после reauth · restore только в тестовый контейнер"
        />
        <DataTable
          rows={conn.backups}
          rowKey={(b) => b.id}
          columns={[
            {
              key: "file",
              header: "Файл",
              render: (b) => b.file.split("/").pop() || b.file,
            },
            { key: "target", header: "Цель", render: (b) => b.target },
            { key: "trigger", header: "Как", render: (b) => b.trigger },
            {
              key: "status",
              header: "Статус",
              render: (b) => (
                <Pill
                  tone={
                    b.status === "error"
                      ? "red"
                      : b.status === "ok" || b.status === "verified"
                        ? "green"
                        : "yellow"
                  }
                >
                  {b.status}
                </Pill>
              ),
            },
            {
              key: "size",
              header: "Размер",
              render: (b) => fmtBytes(b.sizeBytes),
            },
            {
              key: "actions",
              header: "",
              render: (b) => (
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDownloadId(b.id);
                      setErr(null);
                    }}
                  >
                    Скачать
                  </Button>
                  {canRestore && b.target !== "uploads" ? (
                    <Button
                      variant="danger"
                      onClick={() => {
                        setRestoreId(b.id);
                        setConfirmName("");
                        setErr(null);
                      }}
                    >
                      Тест restore
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
        <p className="mt-2 text-[12px] text-mu">
          Кнопки «восстановить в прод» нет и не будет в этой фазе.
        </p>
      </Card>

      <ConfirmDialog
        open={!!downloadId}
        title="Скачать зашифрованный бэкап"
        confirmLabel="Скачать .enc"
        busy={busy}
        onCancel={() => setDownloadId(null)}
        onConfirm={() => void confirmDownload()}
      >
        <p className="mb-2">Нужен повторный ввод пароля (reauth).</p>
        <input
          type="password"
          className="w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
          placeholder="Пароль"
          value={reauthPassword}
          onChange={(e) => setReauthPassword(e.target.value)}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={!!restoreId}
        title="Тестовый restore"
        confirmLabel="Восстановить в тест"
        danger
        busy={busy}
        onCancel={() => setRestoreId(null)}
        onConfirm={() => void confirmRestore()}
      >
        <p className="mb-2">
          Данные попадут во временный контейнер и будут удалены. Введите точное
          имя подключения или БД: <strong>{conn.name}</strong> /{" "}
          <strong>{conn.database}</strong>
        </p>
        <input
          className="mb-2 w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
          placeholder="Имя для подтверждения"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded-[10px] border border-bd bg-card2 px-3 py-2"
          placeholder="Пароль (reauth)"
          value={reauthPassword}
          onChange={(e) => setReauthPassword(e.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
