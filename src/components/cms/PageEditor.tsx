"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { BLOCK_META, BLOCK_TYPES, type BlockType } from "@/lib/cms-block-meta";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type BlockRow = {
  id: string;
  type: string;
  sortOrder: number;
  data: Record<string, unknown>;
  isHidden: boolean;
  anchor: string | null;
};

type RevisionRow = {
  id: string;
  note: string | null;
  createdAt: string;
  createdById: string | null;
};

type PageData = {
  id: string;
  path: string;
  title: string;
  template: string;
  status: string;
  seoPageId: string | null;
  publishedRevisionId: string | null;
  blocks: BlockRow[];
  seoPage: {
    id: string;
    title: string | null;
    description: string | null;
    path: string;
  } | null;
  revisions: RevisionRow[];
};

type SeoOption = { id: string; path: string; title: string | null };

function blockTitle(b: BlockRow): string {
  const d = b.data || {};
  if (typeof d.title === "string") return d.title;
  const header = d.header as { title?: string } | undefined;
  if (header?.title) return header.title;
  const meta = BLOCK_META[b.type as BlockType];
  return meta?.label || b.type;
}

export function PageEditor({
  initialPage,
  seoPages,
}: {
  initialPage: PageData;
  seoPages: SeoOption[];
}) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [tab, setTab] = useState<"blocks" | "settings" | "seo" | "versions">(
    "blocks",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPage.blocks[0]?.id ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [addType, setAddType] = useState<BlockType>("faq");
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const [title, setTitle] = useState(page.title);
  const [path, setPath] = useState(page.path);
  const [template, setTemplate] = useState(page.template);
  const [status, setStatus] = useState(page.status);
  const [seoPageId, setSeoPageId] = useState(page.seoPageId || "");

  const [seoTitle, setSeoTitle] = useState(page.seoPage?.title || "");
  const [seoDescription, setSeoDescription] = useState(
    page.seoPage?.description || "",
  );

  const selected = page.blocks.find((b) => b.id === selectedId) || null;
  const [dataJson, setDataJson] = useState(
    selected ? JSON.stringify(selected.data, null, 2) : "{}",
  );
  const [anchor, setAnchor] = useState(selected?.anchor || "");
  const [, startTransition] = useTransition();

  function selectBlock(id: string) {
    const b = page.blocks.find((x) => x.id === id) || null;
    startTransition(() => {
      setSelectedId(id);
      setDataJson(b ? JSON.stringify(b.data, null, 2) : "{}");
      setAnchor(b?.anchor || "");
    });
  }

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function refreshPage() {
    const res = await api<{ page: PageData }>(`/api/cms/pages/${page.id}`);
    if (res.data?.page) {
      setPage(res.data.page);
      setDirty(false);
    }
  }

  async function saveSettings() {
    setErr(null);
    const res = await api<{ page: PageData }>(`/api/cms/pages/${page.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title,
        path,
        template,
        status,
        seoPageId: seoPageId || null,
      }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Настройки сохранены");
    setDirty(false);
    await refreshPage();
    router.refresh();
  }

  async function saveSeo() {
    setErr(null);
    if (!page.seoPageId && !seoPageId) {
      const created = await api<{ page: { id: string } }>("/api/seo/pages", {
        method: "POST",
        body: JSON.stringify({
          host: "vaybik.ru",
          path: page.path,
          title: seoTitle,
          description: seoDescription,
        }),
      });
      if (created.error) {
        setErr(created.error.message);
        return;
      }
      await api(`/api/cms/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({ seoPageId: created.data!.page.id }),
      });
      setSeoPageId(created.data!.page.id);
      setMsg("SEO создано и привязано");
      await refreshPage();
      return;
    }
    const id = seoPageId || page.seoPageId!;
    const res = await api(`/api/seo/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: seoTitle,
        description: seoDescription,
        path: page.path,
        host: "vaybik.ru",
      }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("SEO сохранено");
    setDirty(false);
    await refreshPage();
  }

  async function saveBlock() {
    if (!selected) return;
    setErr(null);
    let data: unknown;
    try {
      data = JSON.parse(dataJson);
    } catch {
      setErr("data: невалидный JSON");
      return;
    }
    const res = await api(`/api/cms/pages/${page.id}/blocks`, {
      method: "PATCH",
      body: JSON.stringify({
        blockId: selected.id,
        type: selected.type,
        data,
        anchor: anchor || null,
      }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Блок сохранён");
    setDirty(false);
    await refreshPage();
  }

  async function addBlock() {
    setErr(null);
    const defaults: Record<string, unknown> = {
      hero: { title: "Заголовок", buttons: [] },
      answer: { text: "Короткий ответ", facts: [] },
      cards: { header: { title: "Карточки" }, columns: 3, items: [] },
      steps: { header: { title: "Шаги" }, items: [] },
      faq: {
        header: { title: "FAQ" },
        items: [{ question: "Вопрос?", answer: "Ответ" }],
      },
      team: { header: { title: "Команда" }, people: [] },
      cases: { header: { title: "Кейсы" }, items: [] },
      cta: { title: "Связаться", buttons: [] },
      text: { header: { title: "Текст" }, markdown: "" },
      widget: { key: "studio", htmlSnapshot: "" },
      rawHtml: { html: "<section class=\"sec\"><div class=\"w\"><p>HTML</p></div></section>" },
    };
    const res = await api<{ block: BlockRow }>(
      `/api/cms/pages/${page.id}/blocks`,
      {
        method: "POST",
        body: JSON.stringify({ type: addType, data: defaults[addType] || {} }),
      },
    );
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    selectBlock(res.data!.block.id);
    setMsg("Блок добавлен");
    await refreshPage();
  }

  async function reorder(id: string, dir: -1 | 1) {
    const ids = page.blocks.map((b) => b.id);
    const idx = ids.indexOf(id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[idx], next[j]] = [next[j], next[idx]];
    const res = await api(`/api/cms/pages/${page.id}/blocks`, {
      method: "PATCH",
      body: JSON.stringify({ ids: next }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    await refreshPage();
  }

  async function toggleHidden(b: BlockRow) {
    const res = await api(`/api/cms/pages/${page.id}/blocks`, {
      method: "PATCH",
      body: JSON.stringify({
        blockId: b.id,
        type: b.type,
        isHidden: !b.isHidden,
      }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    await refreshPage();
  }

  async function duplicate(b: BlockRow) {
    const res = await api<{ block: BlockRow }>(
      `/api/cms/pages/${page.id}/blocks`,
      {
        method: "POST",
        body: JSON.stringify({
          type: b.type,
          data: b.data,
          anchor: b.anchor,
          isHidden: b.isHidden,
        }),
      },
    );
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    selectBlock(res.data!.block.id);
    await refreshPage();
  }

  async function removeBlock() {
    if (!deleteBlockId) return;
    const res = await api(`/api/cms/pages/${page.id}/blocks`, {
      method: "DELETE",
      body: JSON.stringify({ blockId: deleteBlockId }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    if (selectedId === deleteBlockId) {
      setSelectedId(null);
      setDataJson("{}");
      setAnchor("");
    }
    setDeleteBlockId(null);
    await refreshPage();
  }

  async function publish() {
    setErr(null);
    const res = await api(`/api/cms/pages/${page.id}/publish`, {
      method: "POST",
      body: JSON.stringify({ note: "публикация из редактора" }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Опубликовано");
    setDirty(false);
    await refreshPage();
    router.refresh();
  }

  async function restore() {
    if (!restoreId) return;
    const res = await api(`/api/cms/revisions/${restoreId}/restore`, {
      method: "POST",
      body: "{}",
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setRestoreId(null);
    setMsg("Версия восстановлена в черновик");
    await refreshPage();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] text-mu">
            <Link href="/site" className="text-ac hover:underline">
              ← Сайт
            </Link>
          </p>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-tight">
            {page.title}
          </h1>
          <p className="mt-1 text-sm text-mu">
            {page.path} ·{" "}
            <Pill
              tone={
                page.status === "PUBLISHED"
                  ? "green"
                  : page.status === "DRAFT"
                    ? "yellow"
                    : "demo"
              }
            >
              {page.status}
            </Pill>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              window.open(`/admin/site-preview/${page.id}?rev=draft`, "_blank")
            }
          >
            Предпросмотр
          </Button>
          <Button variant="ghost" onClick={() => void saveBlock()} disabled={!selected}>
            Сохранить черновик
          </Button>
          <Button onClick={() => void publish()}>Опубликовать</Button>
        </div>
      </div>

      {msg && <p className="text-sm text-gr">{msg}</p>}
      {err && <p className="text-sm text-rd">{err}</p>}
      {dirty && <p className="text-sm text-yl">Есть несохранённые изменения</p>}

      <Segmented
        aria-label="Вкладки редактора"
        value={tab}
        onChange={setTab}
        options={[
          { value: "blocks", label: "Блоки" },
          { value: "settings", label: "Настройки страницы" },
          { value: "seo", label: "SEO" },
          { value: "versions", label: "Версии" },
        ]}
      />

      {tab === "blocks" && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader title="Блоки" />
            <ul className="space-y-2">
              {page.blocks.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => selectBlock(b.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-[13px] ${
                      selectedId === b.id
                        ? "border-ac bg-card2"
                        : "border-bd bg-transparent hover:bg-card2/50"
                    } ${b.isHidden ? "opacity-50" : ""}`}
                  >
                    <div className="font-bold">
                      {BLOCK_META[b.type as BlockType]?.label || b.type}
                    </div>
                    <div className="truncate text-mu">{blockTitle(b)}</div>
                  </button>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void reorder(b.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void reorder(b.id, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void toggleHidden(b)}
                    >
                      {b.isHidden ? "Показать" : "Скрыть"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void duplicate(b)}
                    >
                      Дубль
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteBlockId(b.id)}
                    >
                      ×
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-bd pt-3">
              <Select
                value={addType}
                onChange={(e) => setAddType(e.target.value as BlockType)}
              >
                {BLOCK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BLOCK_META[t].label}
                  </option>
                ))}
              </Select>
              <Button className="w-full" onClick={() => void addBlock()}>
                Добавить блок
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                selected
                  ? `Блок: ${BLOCK_META[selected.type as BlockType]?.label || selected.type}`
                  : "Выберите блок"
              }
            />
            {!selected ? (
              <p className="text-sm text-mu">Слева выберите блок для правки</p>
            ) : (
              <div className="space-y-3">
                {selected.type === "rawHtml" && (
                  <p className="rounded-lg border border-yl/40 bg-yl/10 px-3 py-2 text-[12.5px] text-yl">
                    Сырой HTML: скрипты и опасные атрибуты срезаются на сервере.
                  </p>
                )}
                <Field label="Якорь (id секции)">
                  <Input
                    value={anchor}
                    onChange={(e) => {
                      setAnchor(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="faq"
                  />
                </Field>
                <Field label="Данные (JSON)">
                  <Textarea
                    className="min-h-[320px] font-mono text-[12.5px]"
                    value={dataJson}
                    onChange={(e) => {
                      setDataJson(e.target.value);
                      setDirty(true);
                    }}
                  />
                </Field>
                <Button onClick={() => void saveBlock()}>Сохранить блок</Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "settings" && (
        <Card>
          <CardHeader title="Настройки страницы" />
          <div className="grid max-w-xl gap-3">
            <Field label="Название">
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label="Путь">
              <Input
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label="Шаблон">
              <Select
                value={template}
                onChange={(e) => {
                  setTemplate(e.target.value);
                  setDirty(true);
                }}
              >
                <option value="home">home</option>
                <option value="default">default</option>
                <option value="service">service</option>
                <option value="calculator">calculator</option>
              </Select>
            </Field>
            <Field label="Статус">
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setDirty(true);
                }}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </Select>
            </Field>
            <Field label="SeoPage">
              <Select
                value={seoPageId}
                onChange={(e) => {
                  setSeoPageId(e.target.value);
                  setDirty(true);
                }}
              >
                <option value="">— не привязано —</option>
                {seoPages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.path} {s.title ? `— ${s.title}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Button onClick={() => void saveSettings()}>Сохранить</Button>
          </div>
        </Card>
      )}

      {tab === "seo" && (
        <Card>
          <CardHeader
            title="SEO"
            subtitle="Пишет в SeoPage (host vaybik.ru + path страницы)"
          />
          <div className="grid max-w-xl gap-3">
            <Field label="Title">
              <Input
                value={seoTitle}
                onChange={(e) => {
                  setSeoTitle(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={seoDescription}
                onChange={(e) => {
                  setSeoDescription(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Button onClick={() => void saveSeo()}>Сохранить SEO</Button>
          </div>
        </Card>
      )}

      {tab === "versions" && (
        <Card>
          <CardHeader title="Версии" />
          {page.revisions.length === 0 ? (
            <p className="text-sm text-mu">Пока нет публикаций</p>
          ) : (
            <ul className="space-y-2">
              {page.revisions.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-bd px-3 py-2"
                >
                  <div>
                    <div className="text-[13px] font-bold">
                      {formatDateTime(r.createdAt)}
                      {page.publishedRevisionId === r.id ? (
                        <Pill tone="green" className="ml-2">
                          текущая
                        </Pill>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-mu">
                      {r.note || "—"} · {r.createdById || "система"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        window.open(
                          `/admin/site-preview/${page.id}?rev=${r.id}`,
                          "_blank",
                        )
                      }
                    >
                      Смотреть
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRestoreId(r.id)}
                    >
                      Восстановить
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleteBlockId)}
        title="Удалить блок?"
        confirmLabel="Удалить"
        danger
        onConfirm={() => void removeBlock()}
        onCancel={() => setDeleteBlockId(null)}
      >
        Блок будет удалён из черновика.
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(restoreId)}
        title="Восстановить версию?"
        confirmLabel="Восстановить"
        onConfirm={() => void restore()}
        onCancel={() => setRestoreId(null)}
      >
        Текущий черновик сохранится как ревизия «до восстановления».
      </ConfirmDialog>
    </div>
  );
}
