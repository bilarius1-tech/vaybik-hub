"use client";

import { Field, Input, Textarea } from "@/components/ui/Field";

export type HeaderValue = {
  kicker?: string | null;
  title?: string | null;
  subtitle?: string | null;
};

export function HeaderFields({
  value,
  onChange,
}: {
  value: HeaderValue | null | undefined;
  onChange: (v: HeaderValue) => void;
}) {
  const v = value || {};
  return (
    <div className="space-y-1">
      <Field label="Кикер">
        <Input
          value={v.kicker || ""}
          onChange={(e) => onChange({ ...v, kicker: e.target.value || null })}
        />
      </Field>
      <Field label="Заголовок секции">
        <Input
          value={v.title || ""}
          onChange={(e) => onChange({ ...v, title: e.target.value || null })}
        />
      </Field>
      <Field label="Подзаголовок">
        <Textarea
          rows={2}
          value={v.subtitle || ""}
          onChange={(e) => onChange({ ...v, subtitle: e.target.value || null })}
        />
      </Field>
    </div>
  );
}
