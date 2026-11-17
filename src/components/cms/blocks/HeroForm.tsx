"use client";

import { ButtonsRepeater } from "@/components/cms/fields/ButtonsRepeater";
import { IconField } from "@/components/cms/fields/IconField";
import { ImageField } from "@/components/cms/fields/ImageField";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { MediaRef } from "@/lib/cms-block-schemas";

type HeroData = {
  variant?: "home" | "sub" | "service";
  kicker?: string | null;
  title?: string;
  titleAccent?: string | null;
  lead?: string | null;
  buttons?: Array<{ label: string; href: string; style?: "primary" | "secondary" }>;
  mascot?: string;
  feats?: Array<{ icon?: string | null; title?: string | null; text: string }>;
  rings?: unknown;
  image?: MediaRef;
};

export function HeroForm({
  data,
  onChange,
}: {
  data: HeroData;
  onChange: (data: HeroData) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Вариант">
        <Select
          value={data.variant || "home"}
          onChange={(e) =>
            onChange({
              ...data,
              variant: e.target.value as HeroData["variant"],
            })
          }
        >
          <option value="home">home</option>
          <option value="sub">sub</option>
          <option value="service">service</option>
        </Select>
      </Field>
      <Field label="Кикер">
        <Input
          value={data.kicker || ""}
          onChange={(e) => onChange({ ...data, kicker: e.target.value || null })}
        />
      </Field>
      <Field label="Заголовок">
        <Input
          value={data.title || ""}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
        />
      </Field>
      <Field label="Акцент в заголовке">
        <Input
          value={data.titleAccent || ""}
          onChange={(e) =>
            onChange({ ...data, titleAccent: e.target.value || null })
          }
        />
      </Field>
      <Field label="Лид">
        <Textarea
          rows={3}
          value={data.lead || ""}
          onChange={(e) => onChange({ ...data, lead: e.target.value || null })}
        />
      </Field>
      <Field label="Маскот">
        <Input
          value={data.mascot || "privet"}
          onChange={(e) => onChange({ ...data, mascot: e.target.value })}
        />
      </Field>
      <ImageField
        label="Картинка (вместо маскота, по желанию)"
        value={data.image}
        onChange={(image) => onChange({ ...data, image })}
      />
      <ButtonsRepeater
        value={data.buttons || []}
        onChange={(buttons) => onChange({ ...data, buttons })}
      />
      <Repeater
        label="Фичи"
        items={data.feats || []}
        onChange={(feats) => onChange({ ...data, feats })}
        createItem={() => ({ title: "Фича", text: "Описание", icon: "" })}
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Заголовок">
              <Input
                value={it.title || ""}
                onChange={(e) => update({ title: e.target.value || null })}
              />
            </Field>
            <Field label="Описание">
              <Input
                value={it.text}
                onChange={(e) => update({ text: e.target.value })}
              />
            </Field>
            <IconField
              value={it.icon}
              onChange={(icon) => update({ icon })}
            />
          </>
        )}
      />
    </div>
  );
}
