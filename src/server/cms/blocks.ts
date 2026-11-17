import { z } from "zod";
import {
  BLOCK_META,
  BLOCK_TYPES,
  type BlockType,
} from "@/lib/cms-block-meta";
import { mediaRefSchema } from "@/lib/cms-block-schemas";
import {
  sanitizeCmsHtml,
  sanitizeRichText,
  sanitizeSvgIcon,
} from "./sanitize";

export { BLOCK_META, BLOCK_TYPES, type BlockType };

const optionalString = z.string().optional().nullable();

const richHtml = (preset: "full" | "basic" | "inline") =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? sanitizeRichText(v, preset) : v));

const mediaRefField = mediaRefSchema.optional().nullable();

const headerSchema = z
  .object({
    kicker: optionalString,
    title: optionalString,
    subtitle: optionalString,
  })
  .optional()
  .nullable();

const backgroundSchema = z.enum(["default", "alt"]).default("default");

const iconField = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? sanitizeSvgIcon(v) : v));

const buttonSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  style: z.enum(["primary", "secondary"]).default("primary"),
  icon: iconField,
});

export const heroBlockSchema = z.object({
  variant: z.enum(["home", "sub", "service"]).default("home"),
  avHero: z.boolean().optional().default(false),
  keysyHero: z.boolean().optional().default(false),
  kicker: optionalString,
  title: z.string().min(1),
  titleAccent: optionalString,
  titleVisual: optionalString,
  lead: optionalString,
  buttons: z.array(buttonSchema).default([]),
  /** brand-lockup (1С / Битрикс) */
  brandHtml: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? sanitizeCmsHtml(v) : v)),
  /** svc-note под лидом */
  notes: z.array(z.string()).optional().default([]),
  mascot: z.string().default("privet"),
  feats: z
    .array(
      z.object({
        icon: iconField,
        /** Заголовок в <b>; если пусто — text целиком в <b> (legacy) */
        title: optionalString,
        text: z.string().min(1),
      }),
    )
    .default([]),
  /** Сырой JSON из data-magic-rings (строка сохраняет порядок ключей leadweb) */
  rings: z.unknown().optional().nullable(),
  /** Сырой JSON из data-gradient-blinds */
  gradientBlinds: z.unknown().optional().nullable(),
  image: mediaRefField,
});

export const answerBlockSchema = z
  .object({
    header: headerSchema,
    /** @deprecated — используйте html */
    text: z.string().optional().default(""),
    html: richHtml("basic"),
    facts: z
      .array(
        z.object({
          value: z.string().min(1),
          label: z.string().min(1),
        }),
      )
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (!(v.html || "").trim() && !(v.text || "").trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Нужен текст ответа",
        path: ["html"],
      });
    }
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
        kicker: optionalString,
        title: z.string().min(1),
        text: optionalString,
        textHtml: richHtml("basic"),
        price: optionalString,
        checklist: z.array(z.string()).optional(),
        link: z
          .object({ label: z.string().min(1), href: z.string().min(1) })
          .optional()
          .nullable(),
        highlight: z.boolean().optional(),
        cardStyle: z
          .enum(["default", "dir-link", "teaser"])
          .optional()
          .default("default"),
        image: z.union([z.string(), mediaRefSchema]).optional().nullable(),
      }),
    )
    .default([]),
  /** HTML между заголовком и сеткой (demo-note и т.п.) */
  beforeHtml: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? sanitizeCmsHtml(v) : v)),
  /** HTML после сетки карточек (схемы, пояснения) */
  afterHtml: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? sanitizeCmsHtml(v) : v)),
});
export const stepsBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  variant: z
    .enum(["default", "av", "flow5", "k-steps"])
    .optional()
    .default("default"),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        text: z.string().default(""),
        result: z.string().default(""),
        icon: iconField,
      }),
    )
    .default([]),
});

export const faqBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  items: z
    .array(
      z
        .object({
          question: z.string().min(1),
          icon: iconField,
          /** @deprecated — используйте answerHtml */
          answer: z.string().optional().default(""),
          answerHtml: richHtml("basic"),
        })
        .superRefine((v, ctx) => {
          if (!(v.answerHtml || "").trim() && !(v.answer || "").trim()) {
            ctx.addIssue({
              code: "custom",
              message: "Нужен ответ",
              path: ["answerHtml"],
            });
          }
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
        textHtml: richHtml("inline"),
        photo: z.union([z.string(), mediaRefSchema]).optional().nullable(),
        photoAlt: z.string().default(""),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        links: z
          .array(
            z.object({
              label: z.string(),
              href: z.string(),
              icon: iconField,
            }),
          )
          .optional(),
      }),
    )
    .default([]),
});

export const casesBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  variant: z.enum(["default", "portfolio"]).optional().default("default"),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        tag: optionalString,
        text: z.string().default(""),
        textHtml: richHtml("basic"),
        /** «Было» */
        before: optionalString,
        /** «Сделали» — HTML (ul/li) */
        didHtml: richHtml("basic"),
        result: optionalString,
        image: z.union([z.string(), mediaRefSchema]).optional().nullable(),
        imageAlt: optionalString,
        imageWidth: z.number().int().positive().optional(),
        imageHeight: z.number().int().positive().optional(),
        href: optionalString,
        kicker: optionalString,
        more: optionalString,
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
  layout: z.enum(["one", "two"]).optional().default("one"),
  /** @deprecated — используйте html */
  markdown: z.string().default(""),
  html: richHtml("full"),
});

export const widgetBlockSchema = z.object({
  key: z.enum(["studio", "calcMini", "calcFull"]),
  htmlSnapshot: z
    .string()
    .default("")
    .transform((v) => sanitizeCmsHtml(v)),
  /** calcMini: ссылка «Подробный калькулятор» (на главной да, на /uslugi/ нет) */
  showMore: z.boolean().optional(),
});

export const rawHtmlBlockSchema = z.object({
  html: z
    .string()
    .default("")
    .transform((v) => sanitizeCmsHtml(v)),
});

export const iconListBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  variant: z.enum(["plist-cards", "safe"]).default("plist-cards"),
  items: z
    .array(
      z.object({
        icon: iconField,
        title: optionalString,
        textHtml: richHtml("inline"),
        text: optionalString,
      }),
    )
    .default([]),
});

export const offerBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  items: z
    .array(
      z.object({
        kicker: optionalString,
        html: richHtml("basic"),
        /** цена/заголовок-цена — может содержать SVG */
        price: z
          .string()
          .optional()
          .nullable()
          .transform((v) => (v ? sanitizeCmsHtml(v) : v)),
        highlight: z.boolean().optional(),
      }),
    )
    .default([]),
});

export const beforeAfterBlockSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  items: z
    .array(
      z.object({
        before: z.string().default(""),
        after: z.string().default(""),
      }),
    )
    .default([]),
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
  iconList: iconListBlockSchema,
  offer: offerBlockSchema,
  beforeAfter: beforeAfterBlockSchema,
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
