"use client";

import { RichText } from "@/components/cms/RichText";
import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { Field, Select } from "@/components/ui/Field";

type TextData = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  layout?: "one" | "two";
  markdown?: string;
  html?: string | null;
};

export function TextForm({
  data,
  onChange,
}: {
  data: TextData;
  onChange: (data: TextData) => void;
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
      <Field label="Раскладка">
        <Select
          value={data.layout || "one"}
          onChange={(e) =>
            onChange({ ...data, layout: e.target.value as "one" | "two" })
          }
        >
          <option value="one">Одна колонка</option>
          <option value="two">Две колонки (g2)</option>
        </Select>
      </Field>
      <RichText
        label="Текст"
        preset="full"
        value={
          data.html ||
          (data.markdown ? `<p>${data.markdown}</p>` : "")
        }
        onChange={(html) => onChange({ ...data, html, markdown: "" })}
      />
    </div>
  );
}
