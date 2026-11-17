"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type UpdatedBy = { id: string; email: string; name: string | null } | null;

export type PageRow = {
  id: string;
  path: string;
  title: string;
  template: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  deletedAt: string | null;
  updatedById: string | null;
  updatedBy?: UpdatedBy;
  _count: { blocks: number };
};

type ListResponse = {
  pages: PageRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  totalPages: number;
};

type Blocker = { kind: string; label: string; detail?: string };

const STATUS_PILL: Record<
  PageRow["status"],
  { tone: "green" | "yellow" | "demo"; label: string }
> = {
  PUBLISHED: { tone: "green", label: "опубликована" },
  DRAFT: { tone: "yellow", label: "черновик" },
  ARCHIVED: { tone: "demo", label: "архив" },
};

const SORTABLE = [
  "path",
  "title",
  "template",
  "status",
  "blocks",
  "updatedAt",
] as const;

function parseSort(raw: string | null): { key: string; dir: "asc" | "desc" } {
  const s = raw || "-updatedAt";
  if (s.startsWith("-")) return { key: s.slice(1), dir: "desc" };
  return { key: s, dir: "asc" };
}

function actorLabel(p: PageRow): string {
  if (p.updatedBy?.name) return p.updatedBy.name;
  if (p.updatedBy?.email) return p.updatedBy.email;
  return "—";
}

export function PagesList({ isOwner = false }: { isOwner?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize") || "25");
  const pageSize =
    pageSizeRaw === 50 || pageSizeRaw === 100 ? pageSizeRaw : 25;
  const sort = searchParams.get("sort") || "-updatedAt";
  const status = searchParams.get("status") || "ALL";
  const template = searchParams.get("template") || "ALL";
  const trash = searchParams.get("trash") === "1";
  const qParam = searchParams.get("q") || "";

  const [qInput, setQInput] = useState(qParam);
  const [rows, setRows] = useState<PageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newPath, setNewPath] = useState("/");
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] = useState("default");

  const [deleteTarget, setDeleteTarget] = useState<PageRow | null>(null);
  const [deleteBlockers, setDeleteBlockers] = useState<Blocker[] | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<PageRow | null>(null);

  const { key: sortKey, dir: sortDir } = useMemo(
    () => parseSort(sort),
    [sort],
  );

  const replaceParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (!sp.get("tab")) sp.set("tab", "pages");
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || v === "ALL") sp.delete(k);
        else sp.set(k, v);
      }
      if (resetPage) sp.set("page", "1");
      // defaults
      if (!sp.get("sort")) sp.set("sort", "-updatedAt");
      router.replace(`/site?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL → input
    setQInput(qParam);
  }, [qParam]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput === qParam) return;
      replaceParams({ q: qInput.trim() || null }, true);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput, qParam, replaceParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    sp.set("sort", sort);
    if (status !== "ALL") sp.set("status", status);
    if (template !== "ALL") sp.set("template", template);
    if (qParam.trim()) sp.set("q", qParam.trim());
    if (trash) sp.set("trash", "1");
    const res = await api<ListResponse>(`/api/cms/pages?${sp.toString()}`);
    if (res.error) {
      setErr(res.error.message);
      setRows([]);
      setTotal(0);
    } else {
      setRows(res.data!.pages);
      setTotal(res.data!.total);
      setTotalPages(res.data!.totalPages);
    }
    setSelected(new Set());
    setLoading(false);
  }, [page, pageSize, sort, status, template, qParam, trash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
    void load();
  }, [load]);

  function toggleSort(key: string) {
    if (!SORTABLE.includes(key as (typeof SORTABLE)[number])) return;
    let next: string;
    if (sortKey === key) {
      next = sortDir === "asc" ? `-${key}` : key;
    } else {
      next = key === "updatedAt" ? `-${key}` : key;
    }
    replaceParams({ sort: next }, true);
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function createPage() {
    setBusy(true);
    setErr(null);
    const res = await api<{ page: PageRow }>("/api/cms/pages", {
      method: "POST",
      body: JSON.stringify({
        path: newPath,
        title: newTitle,
        template: newTemplate,
      }),
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setCreateOpen(false);
    setNewTitle("");
    router.push(`/site/pages/${res.data!.page.id}`);
  }

  async function publish(id: string) {
    setBusy(true);
    const res = await api(`/api/cms/pages/${id}/publish`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Опубликовано");
    void load();
  }

  async function unpublish(id: string) {
    setBusy(true);
    const res = await api(`/api/cms/pages/${id}/unpublish`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Снято с публикации");
    void load();
  }

  async function duplicate(id: string) {
    setBusy(true);
    const res = await api<{ page: PageRow }>(`/api/cms/pages/${id}/duplicate`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg(`Копия: ${res.data!.page.path}`);
    void load();
  }

  async function restore(id: string) {
    setBusy(true);
    const res = await api(`/api/cms/pages/${id}/restore`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Восстановлено");
    void load();
  }

  async function confirmTrash() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteBlockers(null);
    const res = await api<{ page: PageRow }>(
      `/api/cms/pages/${deleteTarget.id}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (res.error) {
      const blockers = res.error.blockers as Blocker[] | undefined;
      if (blockers?.length) {
        setDeleteBlockers(blockers);
        return;
      }
      setErr(res.error.message);
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    setMsg(`В корзине: ${res.data!.page.path}`);
    void load();
  }

  async function confirmPurge() {
    if (!purgeTarget) return;
    setBusy(true);
    const res = await api(`/api/cms/pages/${purgeTarget.id}?purge=1`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      setPurgeTarget(null);
      return;
    }
    setPurgeTarget(null);
    setMsg("Удалено окончательно");
    void load();
  }

  async function bulk(action: "publish" | "unpublish" | "trash" | "restore" | "purge") {
    if (!selected.size) return;
    setBusy(true);
    const res = await api<{ ok: number; failed: number }>(
      "/api/cms/pages/bulk",
      {
        method: "POST",
        body: JSON.stringify({ ids: [...selected], action }),
      },
    );
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg(
      `Готово: ${res.data!.ok} ок` +
        (res.data!.failed ? `, ${res.data!.failed} с ошибкой` : ""),
    );
    void load();
  }

  function resetFilters() {
    setQInput("");
    replaceParams(
      {
        q: null,
        status: null,
        template: null,
        page: "1",
        pageSize: "25",
        sort: "-updatedAt",
        trash: null,
      },
      true,
    );
  }

  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <Card>
      <CardHeader
        title={trash ? "Корзина страниц" : "Страницы"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-mu">Найдено: {total}</span>
            {!trash ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                + Создать страницу
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                replaceParams({ trash: trash ? null : "1" }, true)
              }
            >
              {trash ? "К списку" : "Корзина"}
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2 px-1">
        <Field label="Поиск">
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Путь или название"
            className="w-48"
            aria-label="Поиск страниц"
          />
        </Field>
        <Field label="Статус">
          <Select
            value={status}
            onChange={(e) =>
              replaceParams({ status: e.target.value }, true)
            }
            aria-label="Фильтр статуса"
          >
            <option value="ALL">Все</option>
            <option value="DRAFT">Черновик</option>
            <option value="PUBLISHED">Опубликована</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </Field>
        <Field label="Шаблон">
          <Select
            value={template}
            onChange={(e) =>
              replaceParams({ template: e.target.value }, true)
            }
            aria-label="Фильтр шаблона"
          >
            <option value="ALL">Все</option>
            <option value="home">home</option>
            <option value="default">default</option>
            <option value="service">service</option>
            <option value="calculator">calculator</option>
            <option value="keysy">keysy</option>
          </Select>
        </Field>
        <Field label="На странице">
          <Select
            value={String(pageSize)}
            onChange={(e) =>
              replaceParams({ pageSize: e.target.value }, true)
            }
            aria-label="Размер страницы"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
        </Field>
        <Button size="sm" variant="ghost" onClick={resetFilters}>
          Сбросить
        </Button>
      </div>

      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-bd bg-card2/50 px-3 py-2 text-[13px]">
          <span className="text-mu">Выбрано: {selected.size}</span>
          {!trash ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void bulk("publish")}
              >
                Опубликовать
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void bulk("unpublish")}
              >
                Снять
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void bulk("trash")}
              >
                В корзину
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void bulk("restore")}
              >
                Восстановить
              </Button>
              {isOwner ? (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void bulk("purge")}
                >
                  Удалить навсегда
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {msg ? <p className="mb-2 text-sm text-gr">{msg}</p> : null}
      {err ? <p className="mb-2 text-sm text-rd">{err}</p> : null}

      {loading ? (
        <p className="px-1 py-6 text-sm text-mu">Загрузка…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title={trash ? "Корзина пуста" : "Нет страниц"}
          description={
            trash
              ? "Удалённые страницы появятся здесь"
              : "Создайте страницу или сбросьте фильтры"
          }
        />
      ) : (
        <DataTable
          rowKey={(p) => p.id}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          selectedIds={selected}
          onRowClick={
            trash
              ? undefined
              : (p) => router.push(`/site/pages/${p.id}`)
          }
          columns={[
            {
              key: "sel",
              header: (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="Выбрать все"
                />
              ),
              className: "w-8",
              render: (p) => (
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={(e) => toggleOne(p.id, e.target.checked)}
                  aria-label={`Выбрать ${p.path}`}
                />
              ),
            },
            {
              key: "path",
              header: "Путь",
              sortable: true,
              render: (p) => (
                <span className="font-medium text-ac">{p.path}</span>
              ),
            },
            {
              key: "title",
              header: "Название",
              sortable: true,
              render: (p) => p.title,
            },
            {
              key: "template",
              header: "Шаблон",
              sortable: true,
              render: (p) => p.template,
            },
            {
              key: "status",
              header: "Статус",
              sortable: true,
              render: (p) => (
                <Pill tone={STATUS_PILL[p.status].tone}>
                  {STATUS_PILL[p.status].label}
                </Pill>
              ),
            },
            {
              key: "blocks",
              header: "Блоков",
              sortable: true,
              className: "w-16",
              render: (p) => p._count.blocks,
            },
            {
              key: "updatedAt",
              header: "Изменено",
              sortable: true,
              render: (p) => formatDateTime(p.updatedAt),
            },
            {
              key: "updatedBy",
              header: "Изменил",
              render: (p) => (
                <span className="text-[12.5px] text-mu">{actorLabel(p)}</span>
              ),
            },
            {
              key: "actions",
              header: "Действия",
              className: "min-w-[220px]",
              render: (p) => (
                <div
                  className="flex flex-wrap gap-1"
                  data-no-row-click
                  onClick={(e) => e.stopPropagation()}
                >
                  {!trash ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/site/pages/${p.id}`)}
                      >
                        Редактировать
                      </Button>
                      <a
                        className="inline-flex h-8 items-center rounded-lg px-2 text-[12.5px] font-semibold text-mu hover:bg-bd/50 hover:text-tx"
                        href={`/admin/site-preview/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Предпросмотр
                      </a>
                      {p.status === "PUBLISHED" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void unpublish(p.id)}
                        >
                          Снять
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void publish(p.id)}
                        >
                          Опубликовать
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void duplicate(p.id)}
                      >
                        Дублировать
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || p.path === "/"}
                        onClick={() => {
                          setDeleteBlockers(null);
                          setDeleteTarget(p);
                        }}
                      >
                        Удалить
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void restore(p.id)}
                      >
                        Восстановить
                      </Button>
                      {isOwner ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => setPurgeTarget(p)}
                        >
                          Удалить навсегда
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] text-mu">
        <span>
          Стр. {page} из {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => replaceParams({ page: String(page - 1) })}
          >
            ← Назад
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => replaceParams({ page: String(page + 1) })}
          >
            Вперёд →
          </Button>
        </div>
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-page-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-bd bg-gradient-to-b from-card2 to-card p-4 shadow-card">
            <h3
              id="create-page-title"
              className="text-[14.5px] font-extrabold text-tx"
            >
              Создать страницу
            </h3>
            <div className="mt-3 space-y-3">
              <Field label="Путь">
                <Input
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="/uslugi/"
                />
              </Field>
              <Field label="Название">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </Field>
              <Field label="Шаблон">
                <Select
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                >
                  <option value="home">home</option>
                  <option value="default">default</option>
                  <option value="service">service</option>
                  <option value="calculator">calculator</option>
            <option value="keysy">keysy</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={busy}
              >
                Отмена
              </Button>
              <Button
                onClick={() => void createPage()}
                disabled={busy || !newTitle.trim()}
              >
                Создать
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteBlockers?.length ? "Удалить нельзя" : "В корзину?"}
        confirmLabel={deleteBlockers?.length ? "Понятно" : "В корзину"}
        danger={!deleteBlockers?.length}
        busy={busy}
        onConfirm={() => {
          if (deleteBlockers?.length) {
            setDeleteTarget(null);
            setDeleteBlockers(null);
            return;
          }
          void confirmTrash();
        }}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteBlockers(null);
        }}
      >
        {deleteTarget ? (
          <div className="space-y-2">
            <p>
              Страница{" "}
              <span className="font-semibold text-tx">{deleteTarget.path}</span>
              {" — "}
              {deleteTarget.title}
            </p>
            {deleteBlockers?.length ? (
              <div className="rounded-lg border border-rd/40 bg-rd/10 p-2 text-rd">
                <p className="font-semibold">Причины:</p>
                <ul className="mt-1 list-disc pl-4">
                  {deleteBlockers.map((b, i) => (
                    <li key={i}>
                      {b.label}
                      {b.detail ? ` (${b.detail})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>Можно будет восстановить из корзины.</p>
            )}
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(purgeTarget)}
        title="Удалить навсегда?"
        confirmLabel="Удалить навсегда"
        danger
        busy={busy}
        onConfirm={() => void confirmPurge()}
        onCancel={() => setPurgeTarget(null)}
      >
        {purgeTarget ? (
          <p>
            Окончательно удалить{" "}
            <span className="font-semibold text-tx">{purgeTarget.path}</span>?
            Действие необратимо.
          </p>
        ) : null}
      </ConfirmDialog>
    </Card>
  );
}
