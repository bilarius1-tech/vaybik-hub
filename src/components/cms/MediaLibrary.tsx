"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, apiForm } from "@/lib/api-client";
import {
  formatBytes,
  mediaPreviewUrl,
  type MediaAssetDto,
  type MediaFolderDto,
  type MediaQuota,
} from "@/lib/media-types";
import { useCallback, useEffect, useRef, useState } from "react";

type ListResponse = {
  items: MediaAssetDto[];
  total: number;
  page: number;
  pageSize: number;
  folders: MediaFolderDto[];
  quota: MediaQuota;
};

type DetailResponse = {
  asset: MediaAssetDto;
  usages: {
    id: string;
    field: string;
    page: { id: string; path: string; title: string };
    block: { id: string; type: string; anchor: string | null } | null;
  }[];
};

export function MediaLibrary({ isOwner = false }: { isOwner?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MediaAssetDto[]>([]);
  const [folders, setFolders] = useState<MediaFolderDto[]>([]);
  const [quota, setQuota] = useState<MediaQuota | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [folder, setFolder] = useState<string>("");
  const [trash, setTrash] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (kind) sp.set("kind", kind);
    if (folder) sp.set("folder", folder);
    if (trash) sp.set("trash", "1");
    const res = await api<ListResponse>(`/api/cms/media?${sp.toString()}`);
    setLoading(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setItems(res.data!.items);
    setFolders(res.data!.folders);
    setQuota(res.data!.quota);
    setTotal(res.data!.total);
  }, [q, kind, folder, trash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset panel
      setDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await api<DetailResponse>(`/api/cms/media/${selectedId}`);
      if (cancelled) return;
      if (res.error) {
        setErr(res.error.message);
        return;
      }
      setDetail(res.data!);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    setErr(null);
    setMsg(null);
    let ok = 0;
    let dup = 0;
    for (let i = 0; i < files.length; i++) {
      const form = new FormData();
      form.set("file", files[i]);
      if (folder && folder !== "root") form.set("folderId", folder);
      const res = await apiForm<{ asset: MediaAssetDto }>("/api/cms/media", form);
      if (res.error) {
        setErr(res.error.message);
      } else if (res.data?.asset.alreadyExists) {
        dup += 1;
      } else {
        ok += 1;
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    setProgress(null);
    setMsg(
      `Загружено: ${ok}${dup ? `, уже есть: ${dup}` : ""}${files.length - ok - dup ? `, ошибок: ${files.length - ok - dup}` : ""}`,
    );
    await load();
  }

  async function saveMeta() {
    if (!detail) return;
    setBusy(true);
    setErr(null);
    const res = await api<{ asset: MediaAssetDto }>(
      `/api/cms/media/${detail.asset.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          alt: detail.asset.alt,
          title: detail.asset.title,
          caption: detail.asset.caption,
          folderId: detail.asset.folderId,
          tags: detail.asset.tags,
        }),
      },
    );
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("Сохранено");
    setDetail({ ...detail, asset: res.data!.asset });
    await load();
  }

  async function doDelete() {
    if (!selectedId) return;
    setBusy(true);
    const res = await api<{ asset: MediaAssetDto }>(
      `/api/cms/media/${selectedId}`,
      { method: "DELETE" },
    );
    setBusy(false);
    setConfirmDelete(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg("В корзине");
    setSelectedId(null);
    await load();
  }

  async function emptyTrash() {
    setBusy(true);
    const res = await api<{ deleted: number }>("/api/cms/media/trash", {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    setConfirmEmpty(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg(`Корзина очищена: ${res.data?.deleted ?? 0}`);
    setSelectedId(null);
    await load();
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    const res = await api<{ folder: MediaFolderDto }>("/api/cms/media/folders", {
      method: "POST",
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setNewFolderName("");
    setMsg("Папка создана");
    await load();
  }

  async function replaceFile(file: File) {
    if (!selectedId) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    const res = await apiForm<{ asset: MediaAssetDto }>(
      `/api/cms/media/${selectedId}/replace`,
      form,
    );
    setBusy(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg(`Заменено, версия ${res.data!.asset.version}`);
    setDetail((d) => (d ? { ...d, asset: res.data!.asset } : d));
    await load();
  }

  const rootFolders = folders.filter((f) => !f.parentId);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_320px]">
      <Card className="h-fit">
        <CardHeader title="Папки" />
        <div className="space-y-1 p-3 pt-0">
          <button
            type="button"
            className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] ${
              !folder && !trash ? "bg-ac/15 font-semibold text-ac" : "text-tx hover:bg-bd/40"
            }`}
            onClick={() => {
              setFolder("");
              setTrash(false);
            }}
          >
            Все файлы
          </button>
          <button
            type="button"
            className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] ${
              folder === "root" ? "bg-ac/15 font-semibold text-ac" : "text-tx hover:bg-bd/40"
            }`}
            onClick={() => {
              setFolder("root");
              setTrash(false);
            }}
          >
            Без папки
          </button>
          {rootFolders.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] ${
                folder === f.id ? "bg-ac/15 font-semibold text-ac" : "text-tx hover:bg-bd/40"
              }`}
              onClick={() => {
                setFolder(f.id);
                setTrash(false);
              }}
            >
              {f.name}
            </button>
          ))}
          <button
            type="button"
            className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] ${
              trash ? "bg-ac/15 font-semibold text-ac" : "text-mu hover:bg-bd/40"
            }`}
            onClick={() => {
              setTrash(true);
              setFolder("");
            }}
          >
            Корзина
          </button>
          <div className="mt-3 flex gap-1">
            <Input
              placeholder="Новая папка"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <Button variant="ghost" onClick={() => void createFolder()}>
              +
            </Button>
          </div>
          {trash && isOwner ? (
            <Button
              variant="danger"
              className="mt-2 w-full"
              onClick={() => setConfirmEmpty(true)}
            >
              Очистить корзину
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <span className="mb-2 self-end text-[12.5px] text-mu">
            Найдено: {total}
          </span>
          <Field label="Поиск" className="min-w-[160px] flex-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="имя, alt, тег…"
            />
          </Field>
          <Field label="Тип">
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="Тип медиа"
            >
              <option value="">Все</option>
              <option value="IMAGE">IMAGE</option>
              <option value="SVG">SVG</option>
              <option value="GIF">GIF</option>
            </Select>
          </Field>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQ("");
              setKind("");
              setFolder("");
              setTrash(false);
            }}
          >
            Сбросить
          </Button>
          <Button
            variant="primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || trash}
          >
            Загрузить
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {quota ? (
          <p className={`text-[12.5px] ${quota.overSoftLimit ? "text-rd" : "text-mu"}`}>
            Объём медиа: {formatBytes(quota.usedBytes)} /{" "}
            {formatBytes(quota.softLimitBytes)}
            {quota.overSoftLimit ? " — мягкий лимит превышен" : ""}
            {" · "}
            файлов: {total.toLocaleString("ru-RU")}
          </p>
        ) : null}

        {msg && <p className="text-sm text-gr">{msg}</p>}
        {err && <p className="text-sm text-rd">{err}</p>}
        {progress ? (
          <p className="text-sm text-mu">
            Загрузка {progress.done}/{progress.total}…
          </p>
        ) : null}

        <div
          className={`rounded-2xl border border-dashed p-2 transition ${
            dragOver ? "border-ac bg-ac/10" : "border-bd"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!trash && e.dataTransfer.files.length) {
              void uploadFiles(e.dataTransfer.files);
            }
          }}
        >
          {loading ? (
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={trash ? "Корзина пуста" : "Пока нет файлов"}
              description={
                trash
                  ? "Удалённые файлы появятся здесь"
                  : "Перетащите картинки сюда или нажмите «Загрузить»"
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 p-1 sm:grid-cols-3 md:grid-cols-4">
              {items.map((a) => {
                const src = mediaPreviewUrl(a);
                const active = selectedId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`overflow-hidden rounded-xl border text-left transition ${
                      active
                        ? "border-ac ring-2 ring-ac/40"
                        : "border-bd hover:border-ac/50"
                    }`}
                  >
                    <div className="relative aspect-square bg-bd/30">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={a.alt || a.originalName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-mu">
                          {a.kind}
                        </div>
                      )}
                      {a.alreadyExists ? (
                        <span className="absolute left-1 top-1">
                          <Pill tone="demo">уже есть</Pill>
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate px-2 py-1.5 text-[11.5px] text-mu">
                      {a.originalName}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Card className="h-fit">
        <CardHeader title="Ассет" />
        {!detail ? (
          <p className="px-4 pb-4 text-[13px] text-mu">Выберите файл слева</p>
        ) : (
          <div className="space-y-3 px-4 pb-4">
            <div className="overflow-hidden rounded-xl border border-bd bg-bd/20">
              {mediaPreviewUrl(detail.asset) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaPreviewUrl(detail.asset)!}
                  alt={detail.asset.alt || ""}
                  className="max-h-48 w-full object-contain"
                />
              ) : null}
            </div>
            <p className="text-[12.5px] text-mu">
              {detail.asset.kind} · {detail.asset.mime}
              {detail.asset.width && detail.asset.height
                ? ` · ${detail.asset.width}×${detail.asset.height}`
                : ""}
              {" · "}
              {formatBytes(detail.asset.size)} · v{detail.asset.version}
            </p>
            <Field label="Название файла">
              <Input value={detail.asset.originalName} disabled />
            </Field>
            <Field label="Title">
              <Input
                value={detail.asset.title || ""}
                onChange={(e) =>
                  setDetail({
                    ...detail,
                    asset: { ...detail.asset, title: e.target.value || null },
                  })
                }
              />
            </Field>
            <Field label="Alt">
              <Input
                value={detail.asset.alt || ""}
                onChange={(e) =>
                  setDetail({
                    ...detail,
                    asset: { ...detail.asset, alt: e.target.value || null },
                  })
                }
              />
            </Field>
            <Field label="Подпись">
              <Textarea
                value={detail.asset.caption || ""}
                rows={2}
                onChange={(e) =>
                  setDetail({
                    ...detail,
                    asset: { ...detail.asset, caption: e.target.value || null },
                  })
                }
              />
            </Field>
            <Field label="Папка">
              <Select
                value={detail.asset.folderId || ""}
                onChange={(e) =>
                  setDetail({
                    ...detail,
                    asset: {
                      ...detail.asset,
                      folderId: e.target.value || null,
                    },
                  })
                }
              >
                <option value="">Без папки</option>
                {rootFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Теги (через запятую)">
              <Input
                value={detail.asset.tags.join(", ")}
                onChange={(e) =>
                  setDetail({
                    ...detail,
                    asset: {
                      ...detail.asset,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void saveMeta()} disabled={busy}>
                Сохранить
              </Button>
              {!detail.asset.deletedAt ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => replaceRef.current?.click()}
                    disabled={busy}
                  >
                    Заменить
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    Удалить
                  </Button>
                </>
              ) : null}
              <input
                ref={replaceRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void replaceFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div>
              <h4 className="mb-1 text-[13px] font-extrabold">Где используется</h4>
              {detail.usages.length === 0 ? (
                <p className="text-[12.5px] text-mu">Нигде</p>
              ) : (
                <ul className="space-y-1 text-[12.5px] text-mu">
                  {detail.usages.map((u) => (
                    <li key={u.id}>
                      {u.page.path} · {u.block?.type || "ревизия"} · {u.field}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить в корзину?"
        confirmLabel="В корзину"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void doDelete()}
      >
        Если файл используется на страницах — удаление будет отклонено.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmEmpty}
        title="Очистить корзину?"
        confirmLabel="Удалить навсегда"
        danger
        busy={busy}
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={() => void emptyTrash()}
      >
        Файлы будут стёрты с диска без возможности восстановления из админки.
      </ConfirmDialog>
    </div>
  );
}
