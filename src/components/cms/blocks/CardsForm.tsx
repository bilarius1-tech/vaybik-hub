"use client";

import { RichText } from "@/components/cms/RichText";
import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { IconField } from "@/components/cms/fields/IconField";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input, Select } from "@/components/ui/Field";

type CardItem = {
  num?: string | null;
  icon?: string | null;
  title: string;
  text?: string | null;
  textHtml?: string | null;
  price?: string | null;
  checklist?: string[];
  link?: { label: string; href: string } | null;
  highlight?: boolean;
};

type CardsData = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  columns?: 2 | 3 | 4;
  items?: CardItem[];
};

export function CardsForm({
  data,
  onChange,
}: {
  data: CardsData;
  onChange: (data: CardsData) => void;
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
      <Field label="Колонки">
        <Select
          value={String(data.columns || 3)}
          onChange={(e) =>
            onChange({
              ...data,
              columns: Number(e.target.value) as 2 | 3 | 4,
            })
          }
        >
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </Select>
      </Field>
      <Repeater
        label="Карточки"
        items={data.items || []}
        onChange={(items) => onChange({ ...data, items })}
        createItem={() => ({ title: "Карточка", textHtml: "" })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Заголовок">
              <Input
                value={it.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </Field>
            <Field label="Номер">
              <Input
                value={it.num || ""}
                onChange={(e) => update({ num: e.target.value || null })}
              />
            </Field>
            <IconField value={it.icon} onChange={(icon) => update({ icon })} />
            <RichText
              label="Текст"
              preset="inline"
              value={it.textHtml || it.text || ""}
              onChange={(textHtml) => update({ textHtml, text: null })}
            />
            <Field label="Цена">
              <Input
                value={it.price || ""}
                onChange={(e) => update({ price: e.target.value || null })}
              />
            </Field>
          </>
        )}
      />
    </div>
  );
}
