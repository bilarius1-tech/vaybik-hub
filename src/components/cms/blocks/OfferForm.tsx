"use client";

import { RichText } from "@/components/cms/RichText";
import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input } from "@/components/ui/Field";

type Data = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  items?: Array<{
    kicker?: string | null;
    html?: string | null;
    price?: string | null;
    highlight?: boolean;
  }>;
};

export function OfferForm({
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
        label="Карточки"
        items={data.items || []}
        onChange={(items) => onChange({ ...data, items })}
        createItem={() => ({ html: "<p></p>", price: null })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Кикер">
              <Input
                value={it.kicker || ""}
                onChange={(e) => update({ kicker: e.target.value || null })}
              />
            </Field>
            <RichText
              label="Текст"
              preset="basic"
              value={it.html || ""}
              onChange={(html) => update({ html })}
            />
            <Field label="Цена">
              <Input
                value={it.price || ""}
                onChange={(e) => update({ price: e.target.value || null })}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12.5px] text-mu">
              <input
                type="checkbox"
                checked={Boolean(it.highlight)}
                onChange={(e) => update({ highlight: e.target.checked })}
              />
              Подсветка
            </label>
          </>
        )}
      />
    </div>
  );
}
