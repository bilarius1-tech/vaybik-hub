"use client";

import { RichText } from "@/components/cms/RichText";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input } from "@/components/ui/Field";

type AnswerData = {
  text?: string;
  html?: string | null;
  facts?: Array<{ value: string; label: string }>;
};

export function AnswerForm({
  data,
  onChange,
}: {
  data: AnswerData;
  onChange: (data: AnswerData) => void;
}) {
  return (
    <div className="space-y-3">
      <RichText
        label="Текст ответа"
        preset="basic"
        value={data.html || (data.text ? `<p>${data.text}</p>` : "")}
        onChange={(html) => onChange({ ...data, html, text: "" })}
      />
      <Repeater
        label="Факты"
        items={data.facts || []}
        onChange={(facts) => onChange({ ...data, facts })}
        createItem={() => ({ value: "0", label: "подпись" })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Значение">
              <Input
                value={it.value}
                onChange={(e) => update({ value: e.target.value })}
              />
            </Field>
            <Field label="Подпись">
              <Input
                value={it.label}
                onChange={(e) => update({ label: e.target.value })}
              />
            </Field>
          </>
        )}
      />
    </div>
  );
}
