"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { MediaLibrary } from "@/components/cms/MediaLibrary";
import { PagesList } from "@/components/cms/PagesList";
import { api } from "@/lib/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type NavPageOpt = { id: string; path: string; title: string };

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

type Tab = "pages" | "nav" | "redirects" | "media";

export function SitePanel({
  initialNav,
  initialRedirects,
  navPages,
  isOwner = false,
}: {
  initialNav: NavRow[];
  initialRedirects: RedirectRow[];
  navPages: NavPageOpt[];
  isOwner?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab =
    tabParam === "nav" ||
    tabParam === "redirects" ||
    tabParam === "media" ||
    tabParam === "pages"
      ? tabParam
      : "pages";

  const [nav, setNav] = useState(initialNav);
  const [redirects, setRedirects] = useState(initialRedirects);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [navMenu, setNavMenu] = useState<"HEADER" | "FOOTER">("HEADER");
  const [navLabel, setNavLabel] = useState("");
  const [navUrl, setNavUrl] = useState("");
  const [navPageId, setNavPageId] = useState("");
  const [navParentId, setNavParentId] = useState("");
  const [navCreateOpen, setNavCreateOpen] = useState(false);

  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [match, setMatch] = useState<"EXACT" | "PREFIX">("EXACT");
  const [redirectCreateOpen, setRedirectCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [redirQ, setRedirQ] = useState("");

  function setTab(next: Tab) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", next);
    if (next !== "pages") {
      sp.delete("page");
      sp.delete("pageSize");
      sp.delete("sort");
      sp.delete("q");
      sp.delete("status");
      sp.delete("template");
      sp.delete("trash");
    }
    router.replace(`/site?${sp.toString()}`, { scroll: false });
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
    setNavCreateOpen(false);
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
    setRedirectCreateOpen(false);
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

  async function toggleRedirect(id: string, isActive: boolean) {
    const res = await api<{ redirect: RedirectRow }>(
      `/api/cms/redirects/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      },
    );
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setRedirects((prev) =>
      prev.map((r) => (r.id === id ? res.data!.redirect : r)),
    );
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

  async function deleteNav(id: string) {
    const res = await api("/api/cms/nav", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setNav((prev) => prev.filter((n) => n.id !== id && n.parentId !== id));
    setMsg("Пункт меню удалён");
  }

  const headerRoots = nav
    .filter((n) => n.menu === "HEADER" && !n.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const footerRoots = nav
    .filter((n) => n.menu === "FOOTER" && !n.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const filteredRedirects = useMemo(() => {
    const s = redirQ.trim().toLowerCase();
    if (!s) return redirects;
    return redirects.filter(
      (r) =>
        r.fromPath.toLowerCase().includes(s) ||
        r.toPath.toLowerCase().includes(s),
    );
  }, [redirects, redirQ]);

  function renderNavTree(roots: NavRow[]) {
    if (!roots.length) {
      return (
        <EmptyState title="Пусто" description="Добавьте пункт меню" />
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void deleteNav(r.id)}
                >
                  Удалить
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void deleteNav(c.id)}
                      >
                        Удалить
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

      {tab === "pages" && <PagesList isOwner={isOwner} />}

      {tab === "nav" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setNavCreateOpen(true)}>
              + Пункт меню
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="HEADER" />
              {renderNavTree(headerRoots)}
            </Card>
            <Card>
              <CardHeader title="FOOTER" />
              {renderNavTree(footerRoots)}
            </Card>
          </div>
        </div>
      )}

      {tab === "redirects" && (
        <Card>
          <CardHeader
            title="Редиректы"
            action={
              <div className="flex flex-wrap gap-2">
                <span className="self-center text-[12.5px] text-mu">
                  Найдено: {filteredRedirects.length}
                </span>
                <Input
                  placeholder="Поиск…"
                  value={redirQ}
                  onChange={(e) => setRedirQ(e.target.value)}
                  className="w-40"
                  aria-label="Поиск редиректов"
                />
                <Button size="sm" onClick={() => setRedirectCreateOpen(true)}>
                  + Редирект
                </Button>
              </div>
            }
          />
          {filteredRedirects.length === 0 ? (
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
                  header: "Действия",
                  render: (r) => (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void toggleRedirect(r.id, !r.isActive)}
                      >
                        {r.isActive ? "Выключить" : "Включить"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(r.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={filteredRedirects}
            />
          )}
        </Card>
      )}

      {tab === "media" && <MediaLibrary isOwner={isOwner} />}

      {navCreateOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-bd bg-gradient-to-b from-card2 to-card p-4 shadow-card">
            <h3 className="text-[14.5px] font-extrabold">Добавить пункт меню</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  {navPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.path} — {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Или URL" className="sm:col-span-2">
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
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNavCreateOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => void createNav()}
                disabled={!navLabel.trim()}
              >
                Добавить
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {redirectCreateOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-bd bg-gradient-to-b from-card2 to-card p-4 shadow-card">
            <h3 className="text-[14.5px] font-extrabold">Новый редирект</h3>
            <div className="mt-3 space-y-3">
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
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setRedirectCreateOpen(false)}
              >
                Отмена
              </Button>
              <Button onClick={() => void createRedirect()}>Создать</Button>
            </div>
          </div>
        </div>
      ) : null}

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
