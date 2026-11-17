"use client";

import { RichText } from "@/components/cms/RichText";
import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { IconField } from "@/components/cms/fields/IconField";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input, Select } from "@/components/ui/Field";

type Data = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  variant?: "plist-cards" | "safe";
  items?: Array<{
    icon?: string | null;
    title?: string | null;
    textHtml?: string | null;
    text?: string | null;
  }>;
};

export function IconListForm({
  data,
  onChange,
}: {
  data: Data;
  onChange: (data: Data) => void;
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
          value={data.variant || "plist-cards"}
          onChange={(e) =>
            onChange({
              ...data,
              variant: e.target.value as Data["variant"],
            })
          }
        >
          <option value="plist-cards">plist-cards</option>
          <option value="safe">safe</option>
        </Select>
      </Field>
      <Repeater
        label="Пункты"
        items={data.items || []}
        onChange={(items) => onChange({ ...data, items })}
        createItem={() => ({ title: "", textHtml: "", icon: "" })}
        renderItem={(it, _i, { update }) => (
          <>
            <IconField value={it.icon} onChange={(icon) => update({ icon })} />
            <Field label="Заголовок">
              <Input
                value={it.title || ""}
                onChange={(e) => update({ title: e.target.value || null })}
              />
            </Field>
            <RichText
              label="Текст"
              preset="inline"
              value={it.textHtml || it.text || ""}
              onChange={(textHtml) => update({ textHtml })}
            />
          </>
        )}
      />
    </div>
  );
}
