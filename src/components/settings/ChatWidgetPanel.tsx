"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useMemo, useState } from "react";

export type ChatWidgetForm = {
  enabled: boolean;
  src: string;
  publicId: string;
  paths: string[];
};

const DEFAULT_SRC = "https://chat.vaybik.ru/widget.js";

export function ChatWidgetPanel({ initial }: { initial: ChatWidgetForm }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [src, setSrc] = useState(initial.src || DEFAULT_SRC);
  const [publicId, setPublicId] = useState(initial.publicId);
  const [pathsText, setPathsText] = useState(initial.paths.join("\n"));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewCfg: ChatWidgetForm = useMemo(
    () => ({
      enabled,
      src,
      publicId,
      paths: pathsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    }),
    [enabled, src, publicId, pathsText],
  );

  const snippet = `<script src="${previewCfg.src || DEFAULT_SRC}" data-id="${previewCfg.publicId.trim() || "YOUR_PUBLIC_ID"}" async></script>`;
  const scopeHint =
    previewCfg.paths.length === 0
      ? "Пустые пути + включено → виджет на всём сайте"
      : `Только пути: ${previewCfg.paths.join(", ")}`;

  async function save() {
    setErr(null);
    setMsg(null);
    setSaving(true);
    const res = await api<{ widget: ChatWidgetForm }>(
      "/api/site/chat-widget",
      {
        method: "PUT",
        body: JSON.stringify(previewCfg),
      },
    );
    setSaving(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    const w = res.data?.widget;
    if (w) {
      setEnabled(w.enabled);
      setSrc(w.src);
      setPublicId(w.publicId);
      setPathsText(w.paths.join("\n"));
    }
    setMsg("Сохранено — сайт подхватит за несколько секунд");
  }

  return (
    <Card>
      <CardHeader
        title="ИИ-консультант (чат-виджет)"
        subtitle="script с chat.vaybik.ru; произвольный HTML не принимается"
      />
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[14px] font-semibold text-tx">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Включён на публичном сайте
        </label>

        <Field label="publicId (data-id)" htmlFor="chat-public-id">
          <Input
            id="chat-public-id"
            value={publicId}
            onChange={(e) => setPublicId(e.target.value)}
            placeholder="xA6FHnneH5CW"
            autoComplete="off"
          />
        </Field>

        <Field label="src скрипта" htmlFor="chat-src">
          <Input
            id="chat-src"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder={DEFAULT_SRC}
          />
          <p className="mt-1 text-[12px] text-mu">
            Только https://chat.vaybik.ru/… или https://chat-test.vaybik.ru/…
          </p>
        </Field>

        <Field
          label="Пути (по одному на строку; пусто = весь сайт)"
          htmlFor="chat-paths"
        >
          <Textarea
            id="chat-paths"
            rows={4}
            value={pathsText}
            onChange={(e) => setPathsText(e.target.value)}
            placeholder={"/\n/kalkulyator/"}
            className="font-mono text-[12px]"
          />
          <p className="mt-1 text-[12px] text-mu">{scopeHint}</p>
        </Field>

        <Field label="Превью кода вставки">
          <pre className="overflow-x-auto rounded-md border border-bd bg-bg2 p-3 text-[12px] text-tx">
            {snippet}
          </pre>
        </Field>

        {err ? <p className="text-[13px] text-danger">{err}</p> : null}
        {msg ? <p className="text-[13px] text-ok">{msg}</p> : null}

        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Сохраняю…" : "Сохранить"}
        </Button>
      </div>
    </Card>
  );
}
