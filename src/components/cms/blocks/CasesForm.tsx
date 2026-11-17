"use client";

import { RichText } from "@/components/cms/RichText";
import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { ImageField } from "@/components/cms/fields/ImageField";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input, Select } from "@/components/ui/Field";
import type { MediaRef } from "@/lib/cms-block-schemas";

type CaseItem = {
  title: string;
  tag?: string | null;
  text?: string;
  textHtml?: string | null;
  result?: string | null;
  image?: MediaRef | string | null;
  href?: string | null;
};

type CasesData = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  variant?: "default" | "portfolio";
  items?: CaseItem[];
};

export function CasesForm({
  data,
  onChange,
}: {
  data: CasesData;
  onChange: (data: CasesData) => void;
}) {
  return (
    <div className="space-y-3">
      <HeaderFields
        value={data.header}
        onChange={(header) => onChange({ ...data, header })}
      />
      <BackgroundSelect
        value={data.background || "default"}
        onChange={(background) => onChange({ ...data, background })}
      />
      <Field label="Вариант">
        <Select
          value={data.variant || "default"}
          onChange={(e) =>
            onChange({
              ...data,
              variant: e.target.value as CasesData["variant"],
            })
          }
        >
          <option value="default">default</option>
          <option value="portfolio">portfolio</option>
        </Select>
      </Field>
      <Repeater
        label="Кейсы"
        items={data.items || []}
        onChange={(items) => onChange({ ...data, items })}
        createItem={() => ({ title: "Кейс", textHtml: "" })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Заголовок">
              <Input
                value={it.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </Field>
            <Field label="Тег">
              <Input
                value={it.tag || ""}
                onChange={(e) => update({ tag: e.target.value || null })}
              />
            </Field>
            <ImageField
              value={it.image}
              onChange={(image) => update({ image })}
            />
            <RichText
              label="Текст"
              preset="inline"
              value={it.textHtml || it.text || ""}
              onChange={(textHtml) => update({ textHtml, text: "" })}
            />
            <Field label="Ссылка">
              <Input
                value={it.href || ""}
                onChange={(e) => update({ href: e.target.value || null })}
              />
            </Field>
          </>
        )}
      />
    </div>
  );
}
