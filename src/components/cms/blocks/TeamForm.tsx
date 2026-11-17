"use client";

import { RichText } from "@/components/cms/RichText";
import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { ImageField } from "@/components/cms/fields/ImageField";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input, Textarea } from "@/components/ui/Field";
import type { MediaRef } from "@/lib/cms-block-schemas";

type Person = {
  name: string;
  role?: string;
  quote?: string;
  text?: string;
  textHtml?: string | null;
  photo?: MediaRef | string;
  photoAlt?: string;
};

type TeamData = {
  header?: { kicker?: string | null; title?: string | null; subtitle?: string | null } | null;
  background?: "default" | "alt";
  people?: Person[];
};

export function TeamForm({
  data,
  onChange,
}: {
  data: TeamData;
  onChange: (data: TeamData) => void;
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
        label="Люди"
        items={data.people || []}
        onChange={(people) => onChange({ ...data, people })}
        createItem={() => ({
          name: "Имя",
          role: "",
          textHtml: "",
          photo: { mediaId: null, src: null, alt: null },
        })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Имя">
              <Input
                value={it.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
            <Field label="Роль">
              <Input
                value={it.role || ""}
                onChange={(e) => update({ role: e.target.value })}
              />
            </Field>
            <ImageField
              value={it.photo}
              onChange={(photo) => update({ photo })}
            />
            <Field label="Цитата">
              <Textarea
                rows={2}
                value={it.quote || ""}
                onChange={(e) => update({ quote: e.target.value })}
              />
            </Field>
            <RichText
              label="Текст"
              preset="inline"
              value={it.textHtml || it.text || ""}
              onChange={(textHtml) => update({ textHtml, text: "" })}
            />
          </>
        )}
      />
    </div>
  );
}
