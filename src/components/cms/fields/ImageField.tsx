"use client";

import { MediaPicker } from "@/components/cms/MediaPicker";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import type { MediaRef } from "@/lib/cms-block-schemas";
import { mediaPreviewUrl, type MediaAssetDto } from "@/lib/media-types";
import { useEffect, useState } from "react";

function normalize(value: MediaRef | string | null | undefined): MediaRef {
  if (typeof value === "string") return { src: value, mediaId: null, alt: null };
  if (!value) return { mediaId: null, src: null, alt: null };
  return value;
}

export function ImageField({
  label = "Картинка",
  value,
  onChange,
}: {
  label?: string;
  value: MediaRef | string | null | undefined;
  onChange: (v: MediaRef) => void;
}) {
  const v = normalize(value);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(v.src || null);

  useEffect(() => {
    if (!v.mediaId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(v.src || null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await api<{ asset: MediaAssetDto }>(
        `/api/cms/media/${v.mediaId}`,
      );
      if (cancelled || !res.data?.asset) return;
      setPreview(mediaPreviewUrl(res.data.asset));
    })();
    return () => {
      cancelled = true;
    };
  }, [v.mediaId, v.src]);

  return (
    <div className="space-y-2">
      <Field label={label}>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setOpen(true)}>
            Выбрать…
          </Button>
          {(v.mediaId || v.src) && (
            <Button
              variant="danger"
              onClick={() =>
                onChange({ mediaId: null, src: null, alt: v.alt || null })
              }
            >
              Убрать
            </Button>
          )}
        </div>
      </Field>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={v.alt || ""}
          className="max-h-32 rounded-xl border border-bd object-contain"
        />
      ) : null}
      <Field label="Alt">
        <Input
          value={v.alt || ""}
          onChange={(e) => onChange({ ...v, alt: e.target.value || null })}
        />
      </Field>
      {!v.mediaId && v.src ? (
        <p className="text-[11.5px] text-mu">Старый путь: {v.src}</p>
      ) : null}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(sel) =>
          onChange({
            mediaId: sel.mediaId,
            src: null,
            alt: sel.alt || v.alt || null,
          })
        }
      />
    </div>
  );
}
