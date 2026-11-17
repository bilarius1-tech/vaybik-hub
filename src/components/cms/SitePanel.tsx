"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { MediaLibrary } from "@/components/cms/MediaLibrary";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PageRow = {
  id: string;
  path: string;
  title: string;
  template: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  updatedById: string | null;
  _count: { blocks: number };
};

type NavRow = {
  id: string;
  menu: "HEADER" | "FOOTER";
  parentId: string | null;
  label: string;
  url: string | null;
  pageId: string | null;
  sortOrder: number;
  isHidden: boolean;
  isHighlighted: boolean;
  openInNewTab: boolean;
  page?: { id: string; path: string; title: string } | null;
};

type RedirectRow = {
  id: string;
  fromPath: string;
  toPath: string;
  code: number;
  match: "EXACT" | "PREFIX";
  isActive: boolean;
  note: string | null;
};

const STATUS_PILL: Record<
  PageRow["status"],
  { tone: "green" | "yellow" | "demo"; label: string }
> = {
  PUBLISHED: { tone: "green", label: "опубликована" },
  DRAFT: { tone: "yellow", label: "черновик" },
  ARCHIVED: { tone: "demo", label: "архив" },
};

export function SitePanel({
  initialPages,
  initialNav,
  initialRedirects,
  isOwner = false,
}: {
  initialPages: PageRow[];
  initialNav: NavRow[];
  initialRedirects: RedirectRow[];
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pages" | "nav" | "redirects" | "media">(
    "pages",
  );
  const [pages, setPages] = useState(initialPages);
  const [nav, setNav] = useState(initialNav);
  const [redirects, setRedirects] = useState(initialRedirects);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [newPath, setNewPath] = useState("/");
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] = useState("default");

  const [navMenu, setNavMenu] = useState<"HEADER" | "FOOTER">("HEADER");
  const [navLabel, setNavLabel] = useState("");
  const [navUrl, setNavUrl] = useState("");
  const [navPageId, setNavPageId] = useState("");
  const [navParentId, setNavParentId] = useState("");

  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [match, setMatch] = useState<"EXACT" | "PREFIX">("EXACT");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return pages.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (!q.trim()) return true;
      const s = q.trim().toLowerCase();
      return (
        p.path.toLowerCase().includes(s) || p.title.toLowerCase().includes(s)
      );
    });
  }, [pages, statusFilter, q]);

  async function createPage() {
    setErr(null);
    setMsg(null);
    const res = await api<{ page: PageRow }>("/api/cms/pages", {
      method: "POST",
      body: JSON.stringify({
        path: newPath,
        title: newTitle,
        template: newTemplate,
      }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Страница создана");
    setPages((prev) => [
      ...prev,
      { ...res.data!.page, _count: { blocks: 0 } },
    ]);
    router.push(`/site/pages/${res.data!.page.id}`);
    router.refresh();
  }

  async function createNav() {
    setErr(null);
    const body: Record<string, unknown> = {
      menu: navMenu,
      label: navLabel,
      sortOrder: nav.filter((n) => n.menu === navMenu).length,
      parentId: navParentId || null,
    };
    if (navPageId) body.pageId = navPageId;
    else body.url = navUrl;
    const res = await api<{ item: NavRow }>("/api/cms/nav", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setNav((prev) => [...prev, res.data!.item]);
    setNavLabel("");
    setNavUrl("");
    setNavPageId("");
    setMsg("Пункт меню добавлен");
    router.refresh();
  }

  async function createRedirect() {
    setErr(null);
    const res = await api<{ redirect: RedirectRow; warnings?: string[] }>(
      "/api/cms/redirects",
      {
        method: "POST",
        body: JSON.stringify({ fromPath, toPath, match, code: 301 }),
      },
    );
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setRedirects((prev) =>
      [...prev, res.data!.redirect].sort((a, b) =>
        a.fromPath.localeCompare(b.fromPath),
      ),
    );
    setFromPath("");
    setToPath("");
    setMsg(
      res.data!.warnings?.length
        ? `Редирект создан (${res.data!.warnings.join("; ")})`
        : "Редирект создан",
    );
    router.refresh();
  }

  async function deleteRedirect() {
    if (!deleteId) return;
    const res = await api("/api/cms/redirects/" + deleteId, {
      method: "DELETE",
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setRedirects((prev) => prev.filter((r) => r.id !== deleteId));
    setDeleteId(null);
    setMsg("Редирект удалён");
  }

  async function moveNav(id: string, dir: -1 | 1) {
    const item = nav.find((n) => n.id === id);
    if (!item) return;
    const siblings = nav
      .filter((n) => n.menu === item.menu && n.parentId === item.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = siblings.findIndex((n) => n.id === id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    const items = siblings.map((n) => {
      if (n.id === id) return { id: n.id, sortOrder: swap.sortOrder };
      if (n.id === swap.id) return { id: n.id, sortOrder: item.sortOrder };
      return { id: n.id, sortOrder: n.sortOrder };
    });
    const res = await api<{ items: NavRow[] }>("/api/cms/nav", {
      method: "PATCH",
      body: JSON.stringify({ items }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setNav(res.data!.items);
  }

  async function toggleNavHidden(id: string, isHidden: boolean) {
    const res = await api<{ item: NavRow }>("/api/cms/nav", {
      method: "PATCH",
      body: JSON.stringify({ id, isHidden }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setNav((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...res.data!.item } : n)),
    );
  }

  const headerRoots = nav
    .filter((n) => n.menu === "HEADER" && !n.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const footerRoots = nav
    .filter((n) => n.menu === "FOOTER" && !n.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function renderNavTree(roots: NavRow[]) {
    if (!roots.length) {
      return (
        <EmptyState title="Пусто" description="Добавьте пункт меню ниже" />
      );
    }
    return (
      <ul className="space-y-2 text-sm">
        {roots.map((r) => {
          const children = nav
            .filter((c) => c.parentId === r.id)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <li
              key={r.id}
              className="rounded-xl border border-bd bg-card2/40 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={r.isHidden ? "opacity-50" : ""}>
                  {r.label}{" "}
                  <span className="text-mu">
                    ({r.url || r.page?.path || "—"})
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void moveNav(r.id, -1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void moveNav(r.id, 1)}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void toggleNavHidden(r.id, !r.isHidden)}
                >
                  {r.isHidden ? "Показать" : "Скрыть"}
                </Button>
              </div>
              {children.length > 0 && (
                <ul className="mt-2 space-y-1 border-l border-bd pl-3">
                  {children.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      <span className={c.isHidden ? "opacity-50" : ""}>
                        {c.isHighlighted ? "★ " : ""}
                        {c.label}{" "}
                        <span className="text-mu">
                          ({c.url || c.page?.path || "—"})
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void moveNav(c.id, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void moveNav(c.id, 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void toggleNavHidden(c.id, !c.isHidden)}
                      >
                        {c.isHidden ? "Показать" : "Скрыть"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Сайт</h1>
          <p className="mt-1 text-sm text-mu">
            Страницы, медиа, меню и редиректы vaybik.ru (публичный сайт пока
            статикой)
          </p>
        </div>
        <Segmented
          aria-label="Разделы сайта"
          value={tab}
          onChange={setTab}
          options={[
            { value: "pages", label: "Страницы" },
            { value: "media", label: "Медиа" },
            { value: "nav", label: "Меню" },
            { value: "redirects", label: "Редиректы" },
          ]}
        />
      </div>

      {msg && <p className="text-sm text-gr">{msg}</p>}
      {err && <p className="text-sm text-rd">{err}</p>}

      {tab === "pages" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader
              title="Страницы"
              action={
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Фильтр статуса"
                  >
                    <option value="ALL">Все статусы</option>
                    <option value="DRAFT">Черновик</option>
                    <option value="PUBLISHED">Опубликована</option>
                    <option value="ARCHIVED">Архив</option>
                  </Select>
                  <Input
                    placeholder="Поиск…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-40"
                  />
                </div>
              }
            />
            {filtered.length === 0 ? (
              <EmptyState
                title="Нет страниц"
                description="Создайте страницу или запустите импорт leadweb"
              />
            ) : (
              <DataTable
                rowKey={(p) => p.id}
                columns={[
                  {
                    key: "path",
                    header: "Путь",
                    render: (p) => (
                      <Link
                        className="font-medium text-ac hover:underline"
                        href={`/site/pages/${p.id}`}
                      >
                        {p.path}
                      </Link>
                    ),
                  },
                  { key: "title", header: "Название", render: (p) => p.title },
                  {
                    key: "template",
                    header: "Шаблон",
                    render: (p) => p.template,
                  },
                  {
                    key: "status",
                    header: "Статус",
                    render: (p) => (
                      <Pill tone={STATUS_PILL[p.status].tone}>
                        {STATUS_PILL[p.status].label}
                      </Pill>
                    ),
                  },
                  {
                    key: "blocks",
                    header: "Блоков",
                    render: (p) => p._count.blocks,
                  },
                  {
                    key: "updated",
                    header: "Изменено",
                    render: (p) => formatDateTime(p.updatedAt),
                  },
                ]}
                rows={filtered}
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Создать страницу" />
            <div className="space-y-3">
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
                </Select>
              </Field>
              <Button onClick={() => void createPage()} disabled={!newTitle.trim()}>
                Создать страницу
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "nav" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="HEADER" />
            {renderNavTree(headerRoots)}
          </Card>
          <Card>
            <CardHeader title="FOOTER" />
            {renderNavTree(footerRoots)}
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Добавить пункт" />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Меню">
                <Select
                  value={navMenu}
                  onChange={(e) =>
                    setNavMenu(e.target.value as "HEADER" | "FOOTER")
                  }
                >
                  <option value="HEADER">HEADER</option>
                  <option value="FOOTER">FOOTER</option>
                </Select>
              </Field>
              <Field label="Подпись">
                <Input
                  value={navLabel}
                  onChange={(e) => setNavLabel(e.target.value)}
                />
              </Field>
              <Field label="Родитель (опц.)">
                <Select
                  value={navParentId}
                  onChange={(e) => setNavParentId(e.target.value)}
                >
                  <option value="">— верхний уровень —</option>
                  {nav
                    .filter((n) => n.menu === navMenu && !n.parentId)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Страница">
                <Select
                  value={navPageId}
                  onChange={(e) => {
                    setNavPageId(e.target.value);
                    if (e.target.value) setNavUrl("");
                  }}
                >
                  <option value="">— URL вручную —</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.path} — {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Или URL">
                <Input
                  value={navUrl}
                  onChange={(e) => {
                    setNavUrl(e.target.value);
                    if (e.target.value) setNavPageId("");
                  }}
                  placeholder="/o-nas/#contacts"
                  disabled={Boolean(navPageId)}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  onClick={() => void createNav()}
                  disabled={!navLabel.trim()}
                >
                  Добавить
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "redirects" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader title="Редиректы" />
            {redirects.length === 0 ? (
              <EmptyState title="Нет редиректов" />
            ) : (
              <DataTable
                rowKey={(r) => r.id}
                columns={[
                  {
                    key: "from",
                    header: "Откуда",
                    render: (r) => r.fromPath,
                  },
                  { key: "to", header: "Куда", render: (r) => r.toPath },
                  { key: "code", header: "Код", render: (r) => r.code },
                  { key: "match", header: "Тип", render: (r) => r.match },
                  {
                    key: "active",
                    header: "Активен",
                    render: (r) => (r.isActive ? "да" : "нет"),
                  },
                  {
                    key: "actions",
                    header: "",
                    render: (r) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(r.id)}
                      >
                        Удалить
                      </Button>
                    ),
                  },
                ]}
                rows={redirects}
              />
            )}
          </Card>
          <Card>
            <CardHeader title="Новый редирект" />
            <div className="space-y-3">
              <Field label="from">
                <Input
                  value={fromPath}
                  onChange={(e) => setFromPath(e.target.value)}
                  placeholder="/old/"
                />
              </Field>
              <Field label="to">
                <Input
                  value={toPath}
                  onChange={(e) => setToPath(e.target.value)}
                  placeholder="/new/"
                />
              </Field>
              <Field label="Тип">
                <Select
                  value={match}
                  onChange={(e) =>
                    setMatch(e.target.value as "EXACT" | "PREFIX")
                  }
                >
                  <option value="EXACT">EXACT</option>
                  <option value="PREFIX">PREFIX</option>
                </Select>
              </Field>
              <Button onClick={() => void createRedirect()}>Создать</Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "media" && <MediaLibrary isOwner={isOwner} />}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Удалить редирект?"
        confirmLabel="Удалить"
        danger
        onConfirm={() => void deleteRedirect()}
        onCancel={() => setDeleteId(null)}
      >
        Действие необратимо.
      </ConfirmDialog>
    </div>
  );
}
