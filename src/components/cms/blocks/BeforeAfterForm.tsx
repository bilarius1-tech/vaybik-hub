"use client";

import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input } from "@/components/ui/Field";

type Data = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  items?: Array<{ before: string; after: string }>;
};

export function BeforeAfterForm({
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
      <Repeater
        label="Пары"
        items={data.items || []}
        onChange={(items) => onChange({ ...data, items })}
        createItem={() => ({ before: "", after: "" })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Было">
              <Input
                value={it.before}
                onChange={(e) => update({ before: e.target.value })}
              />
            </Field>
            <Field label="Стало">
              <Input
                value={it.after}
                onChange={(e) => update({ after: e.target.value })}
              />
            </Field>
          </>
        )}
      />
    </div>
  );
}
