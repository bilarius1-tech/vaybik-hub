"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, apiForm } from "@/lib/api-client";
import {
  mediaPreviewUrl,
  type MediaAssetDto,
} from "@/lib/media-types";
import { useCallback, useEffect, useRef, useState } from "react";

export type MediaPickerValue = { mediaId: string; alt: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (value: MediaPickerValue) => void;
  title?: string;
};

type ListResponse = {
  items: MediaAssetDto[];
  total: number;
};

export function MediaPicker({
  open,
  onClose,
  onSelect,
  title = "Выбрать медиа",
}: Props) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MediaAssetDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (kind) sp.set("kind", kind);
    const res = await api<ListResponse>(`/api/cms/media?${sp.toString()}`);
    setLoading(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setItems(res.data!.items);
  }, [q, kind]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch
    void load();
  }, [open, load]);

  async function upload(file: File) {
    setUploading(true);
    setErr(null);
    const form = new FormData();
    form.set("file", file);
    const res = await apiForm<{ asset: MediaAssetDto }>("/api/cms/media", form);
    setUploading(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    const asset = res.data!.asset;
    onSelect({ mediaId: asset.id, alt: asset.alt || "" });
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-picker-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-bd bg-gradient-to-b from-card2 to-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-bd px-4 py-3">
          <h3
            id="media-picker-title"
            className="text-[14.5px] font-extrabold text-tx"
          >
            {title}
          </h3>
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-bd px-4 py-2">
          <Input
            placeholder="Поиск…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-[200px]"
          />
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Тип"
            className="max-w-[140px]"
          >
            <option value="">Все типы</option>
            <option value="IMAGE">IMAGE</option>
            <option value="SVG">SVG</option>
            <option value="GIF">GIF</option>
          </Select>
          <Button
            variant="primary"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "…" : "Загрузить"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>
        {err ? <p className="px-4 pt-2 text-sm text-rd">{err}</p> : null}
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Ничего не найдено"
              description="Загрузите картинку или измените поиск"
            />
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((a) => {
                const src = mediaPreviewUrl(a);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className="overflow-hidden rounded-xl border border-bd text-left hover:border-ac"
                    onClick={() => {
                      onSelect({
                        mediaId: a.id,
                        alt: a.alt || "",
                      });
                      onClose();
                    }}
                  >
                    <div className="aspect-square bg-bd/30">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={a.alt || a.originalName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="truncate px-2 py-1 text-[11px] text-mu">
                      {a.originalName}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
