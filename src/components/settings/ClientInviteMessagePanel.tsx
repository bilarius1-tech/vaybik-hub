"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useState } from "react";

export function ClientInviteMessagePanel({
  initialTemplate,
  defaultTemplate,
}: {
  initialTemplate: string;
  defaultTemplate: string;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setOk(false);
    const res = await api<{ template: string }>(
      "/api/settings/client-invite-message",
      {
        method: "PUT",
        body: JSON.stringify({ template }),
      },
    );
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error?.message || "Не удалось сохранить");
      return;
    }
    setTemplate(res.data.template);
    setOk(true);
  }

  return (
    <Card>
      <CardHeader
        title="Сообщение клиенту (приглашение)"
        subtitle="для копирования в мессенджер и письма · {имя} {сайт} {ссылка} {вход} {срок_ссылки}"
      />
      <div className="space-y-3 max-w-3xl">
        <Field label="Шаблон" htmlFor="invite-msg-tpl">
          <Textarea
            id="invite-msg-tpl"
            className="min-h-[220px] font-mono text-[12.5px] font-normal leading-relaxed"
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value);
              setOk(false);
            }}
          />
        </Field>
        <p className="text-[12px] text-mu leading-relaxed">
          Без поля «Контакт» в карточке: вместо «&#123;имя&#125;, добрый день!»
          будет «Добрый день!». &#123;сайт&#125; — домен из URL сайта клиента.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Сохраняем…" : "Сохранить шаблон"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setTemplate(defaultTemplate);
              setOk(false);
            }}
          >
            Вернуть текст по умолчанию
          </Button>
        </div>
        {ok ? (
          <p className="text-[13px] font-semibold text-[color:var(--gn,#2f9e44)]">
            Сохранено
          </p>
        ) : null}
        {error ? (
          <p className="text-[13px] font-semibold text-rd">{error}</p>
        ) : null}
      </div>
    </Card>
  );
}
