"use client";

import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { ButtonsRepeater } from "@/components/cms/fields/ButtonsRepeater";
import { Field, Input, Textarea } from "@/components/ui/Field";

type CtaData = {
  title?: string;
  lead?: string | null;
  buttons?: Array<{ label: string; href: string; style?: "primary" | "secondary" }>;
  background?: "default" | "alt";
  rings?: unknown;
};

export function CtaForm({
  data,
  onChange,
}: {
  data: CtaData;
  onChange: (data: CtaData) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Заголовок">
        <Input
          value={data.title || ""}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
        />
      </Field>
      <Field label="Лид">
        <Textarea
          rows={2}
          value={data.lead || ""}
          onChange={(e) => onChange({ ...data, lead: e.target.value || null })}
        />
      </Field>
      <BackgroundSelect
        value={data.background || "default"}
        onChange={(background) => onChange({ ...data, background })}
      />
      <ButtonsRepeater
        value={data.buttons || []}
        onChange={(buttons) => onChange({ ...data, buttons })}
      />
    </div>
  );
}
