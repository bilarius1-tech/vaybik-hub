"use client";

import { RichText } from "@/components/cms/RichText";
import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { IconField } from "@/components/cms/fields/IconField";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input } from "@/components/ui/Field";

type FaqData = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  items?: Array<{
    question: string;
    icon?: string | null;
    answer?: string;
    answerHtml?: string | null;
  }>;
};

export function FaqForm({
  data,
  onChange,
}: {
  data: FaqData;
  onChange: (data: FaqData) => void;
}) {
  const items = data.items || [];
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
      <Repeater
        label="Вопросы"
        items={items}
        onChange={(next) => onChange({ ...data, items: next })}
        createItem={() => ({
          question: "Вопрос?",
          answerHtml: "<p>Ответ</p>",
        })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Вопрос">
              <Input
                value={it.question}
                onChange={(e) => update({ question: e.target.value })}
              />
            </Field>
            <IconField
              label="Иконка"
              value={it.icon || ""}
              onChange={(icon) => update({ icon: icon || null })}
            />
            <RichText
              label="Ответ"
              preset="basic"
              value={it.answerHtml || (it.answer ? `<p>${it.answer}</p>` : "")}
              onChange={(answerHtml) => update({ answerHtml, answer: "" })}
            />
          </>
        )}
      />
    </div>
  );
}
