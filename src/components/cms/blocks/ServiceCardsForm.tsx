"use client";

import { RichText } from "@/components/cms/RichText";
import { BackgroundSelect } from "@/components/cms/fields/BackgroundSelect";
import { HeaderFields } from "@/components/cms/fields/HeaderFields";
import { ImageField } from "@/components/cms/fields/ImageField";
import { Repeater } from "@/components/cms/fields/Repeater";
import { Field, Input, Select } from "@/components/ui/Field";
import type { MediaRef } from "@/lib/cms-block-schemas";

type ServiceCardItem = {
  title: string;
  text?: string | null;
  textHtml?: string | null;
  price?: string | null;
  image?: MediaRef | null;
  button?: {
    label: string;
    href: string;
    style?: "primary" | "secondary";
  } | null;
};

type ServiceCardsData = {
  header?: {
    kicker?: string | null;
    title?: string | null;
    subtitle?: string | null;
  } | null;
  background?: "default" | "alt";
  columns?: 2 | 3;
  items?: ServiceCardItem[];
};

export function ServiceCardsForm({
  data,
  onChange,
}: {
  data: ServiceCardsData;
  onChange: (data: ServiceCardsData) => void;
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
              columns: Number(e.target.value) as 2 | 3,
            })
          }
        >
          <option value="2">2</option>
          <option value="3">3</option>
        </Select>
      </Field>
      <Repeater
        label="Сервисы"
        items={data.items || []}
        onChange={(items) => onChange({ ...data, items })}
        createItem={() =>
          ({
            title: "Сервис",
            textHtml: "<p></p>",
            button: {
              label: "Подробнее",
              href: "#contact",
              style: "secondary" as const,
            },
          }) satisfies ServiceCardItem
        }
        renderItem={(it, _i, { update }) => (
          <>
            <Field label="Заголовок (H3)">
              <Input
                value={it.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </Field>
            <ImageField
              label="Картинка 4:3"
              value={it.image}
              onChange={(image) => update({ image })}
            />
            <RichText
              label="Описание"
              preset="basic"
              value={it.textHtml || it.text || ""}
              onChange={(textHtml) => update({ textHtml, text: "" })}
            />
            <Field label="Цена (опционально)">
              <Input
                value={it.price || ""}
                onChange={(e) => update({ price: e.target.value || null })}
                placeholder="От 1 700 ₽/мес."
              />
            </Field>
            <Field label="Кнопка — текст">
              <Input
                value={it.button?.label || ""}
                onChange={(e) =>
                  update({
                    button: {
                      label: e.target.value || "Подробнее",
                      href: it.button?.href || "#contact",
                      style: it.button?.style || "primary",
                    },
                  })
                }
              />
            </Field>
            <Field label="Кнопка — ссылка">
              <Input
                value={it.button?.href || ""}
                onChange={(e) =>
                  update({
                    button: {
                      label: it.button?.label || "Подробнее",
                      href: e.target.value || "#contact",
                      style: it.button?.style || "primary",
                    },
                  })
                }
              />
            </Field>
            <Field label="Стиль кнопки">
              <Select
                value={it.button?.style || "primary"}
                onChange={(e) =>
                  update({
                    button: {
                      label: it.button?.label || "Подробнее",
                      href: it.button?.href || "#contact",
                      style: e.target.value as "primary" | "secondary",
                    },
                  })
                }
              >
                <option value="primary">Основная</option>
                <option value="secondary">Вторичная</option>
              </Select>
            </Field>
          </>
        )}
      />
    </div>
  );
}
