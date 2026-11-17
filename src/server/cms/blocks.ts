import { z } from "zod";
import { sanitizeCmsHtml, sanitizeSvgIcon } from "./sanitize";

const optionalString = z.string().optional().nullable();

const headerSchema = z
  .object({
    kicker: optionalString,
    title: optionalString,
    subtitle: optionalString,
  })
  .optional()
  .nullable();

const backgroundSchema = z.enum(["default", "alt"]).default("default");

const buttonSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  style: z.enum(["primary", "secondary"]).default("primary"),
});

const iconField = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? sanitizeSvgIcon(v) : v));

export const BLOCK_TYPES = [
  "hero",
  "answer",
  "cards",
  "steps",
  "faq",
  "team",
  "cases",
  "cta",
  "text",
  "widget",
  "rawHtml",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_META: Record<
  BlockType,
  { label: string; description: string }
> = {
  hero: {
    label: "Hero",
    description: "Шапка страницы: заголовок, кнопки, маскот",
  },
  answer: {
    label: "Короткий ответ",
    description: "AEO-блок под hero + факты",
  },
  cards: {
    label: "Карточки",
    description: "Сетка карточек 2–4 колонки",
  },
  steps: {
    label: "Шаги",
    description: "Нумерованный список шагов",
  },
  faq: {
    label: "FAQ",
    description: "Вопросы и ответы (details/summary)",
  },
  team: {
    label: "Команда",
    description: "Люди студии",
  },
  cases: {
    label: "Кейсы",
    description: "Карточки портфолио",
  },
  cta: {
    label: "CTA",
    description: "Призыв к действию / контакты",
  },
  text: {
    label: "Текст",
    description: "Заголовок + markdown",
  },
  widget: {
    label: "Виджет",
    description: "Студия / калькулятор (снимок HTML)",
  },
  rawHtml: {
    label: "HTML",
    description: "Сырой HTML (запасной вариант импорта)",
  },
};

export const heroBlockSchema = z.object({
  variant: z.enum(["home", "sub", "service"]).default("home"),
  kicker: optionalString,
  title: z.string().min(1),
  titleAccent: optionalString,
  lead: optionalString,
  buttons: z.array(buttonSchema).default([]),
  mascot: z.string().default("privet"),
  feats: z
    .array(
      z.object({
        icon: iconField,
        text: z.string().min(1),
      }),
    )
    .default([]),
  rings: z.unknown().optional().nullable(),
});

export const answerBlockSchema = z.object({
  text: z.string().min(1),
  facts: z
    .array(
      z.object({
        value: z.string().min(1),
        label: z.string().min(1),
      }),
    )
    .default([]),
});

export const cardsBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  items: z
    .array(
      z.object({
        num: optionalString,
        icon: iconField,
        title: z.string().min(1),
        text: optionalString,
        price: optionalString,
        checklist: z.array(z.string()).optional(),
        link: z
          .object({ label: z.string().min(1), href: z.string().min(1) })
          .optional()
          .nullable(),
        highlight: z.boolean().optional(),
      }),
    )
    .default([]),
});

export const stepsBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        text: z.string().default(""),
        result: z.string().default(""),
      }),
    )
    .default([]),
});

export const faqBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  items: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .default([]),
});

export const teamBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  people: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().default(""),
        quote: z.string().default(""),
        text: z.string().default(""),
        photo: z.string().default(""),
        photoAlt: z.string().default(""),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      }),
    )
    .default([]),
});

export const casesBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        tag: optionalString,
        text: z.string().default(""),
        result: optionalString,
        image: optionalString,
        href: optionalString,
      }),
    )
    .default([]),
});

export const ctaBlockSchema = z.object({
  title: z.string().min(1),
  lead: optionalString,
  buttons: z.array(buttonSchema).default([]),
  rings: z.unknown().optional().nullable(),
  background: backgroundSchema,
});

export const textBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  markdown: z.string().default(""),
});

export const widgetBlockSchema = z.object({
  key: z.enum(["studio", "calcMini", "calcFull"]),
  htmlSnapshot: z
    .string()
    .default("")
    .transform((v) => sanitizeCmsHtml(v)),
});

export const rawHtmlBlockSchema = z.object({
  html: z
    .string()
    .default("")
    .transform((v) => sanitizeCmsHtml(v)),
});

export const blockDataSchemas = {
  hero: heroBlockSchema,
  answer: answerBlockSchema,
  cards: cardsBlockSchema,
  steps: stepsBlockSchema,
  faq: faqBlockSchema,
  team: teamBlockSchema,
  cases: casesBlockSchema,
  cta: ctaBlockSchema,
  text: textBlockSchema,
  widget: widgetBlockSchema,
  rawHtml: rawHtmlBlockSchema,
} as const;

export function parseBlockData(type: string, data: unknown) {
  if (!(type in blockDataSchemas)) {
    throw Object.assign(new Error(`Неизвестный тип блока: ${type}`), {
      status: 400,
      code: "VALIDATION",
    });
  }
  const schema = blockDataSchemas[type as BlockType];
  return schema.parse(data);
}

export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}
