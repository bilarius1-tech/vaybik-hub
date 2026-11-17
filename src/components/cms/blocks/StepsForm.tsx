"use client";

import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { IconField } from "@/components/cms/fields/IconField";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

type StepsData = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  variant?: "default" | "av" | "flow5" | "k-steps";
  items?: Array<{
    title: string;
    text?: string;
    result?: string;
    icon?: string | null;
  }>;
};

export function StepsForm({
  data,
  onChange,
}: {
  data: StepsData;
  onChange: (data: StepsData) => void;
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
              variant: e.target.value as StepsData["variant"],
            })
          }
        >
          <option value="default">default</option>
          <option value="av">av</option>
          <option value="flow5">flow5</option>
          <option value="k-steps">k-steps</option>
        </Select>
      </Field>
      <Repeater
        label="Шаги"
        items={data.items || []}
        onChange={(items) => onChange({ ...data, items })}
        createItem={() => ({ title: "Шаг", text: "", result: "" })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Заголовок">
              <Input
                value={it.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </Field>
            <IconField value={it.icon} onChange={(icon) => update({ icon })} />
            <Field label="Текст">
              <Textarea
                rows={2}
                value={it.text || ""}
                onChange={(e) => update({ text: e.target.value })}
              />
            </Field>
            <Field label="Результат">
              <Input
                value={it.result || ""}
                onChange={(e) => update({ result: e.target.value })}
              />
            </Field>
          </>
        )}
      />
    </div>
  );
}
