import { z } from "zod";

const optionalString = z.string().optional().nullable();

/** Картинка: mediaId и/или старый src */
export const mediaRefSchema = z.preprocess(
  (v) => {
    if (typeof v === "string") {
      return v ? { src: v, mediaId: null, alt: null } : { src: null, mediaId: null, alt: null };
    }
    if (v == null) return { src: null, mediaId: null, alt: null };
    return v;
  },
  z.object({
    mediaId: z.string().nullable().optional(),
    src: z.string().nullable().optional(),
    alt: z.string().nullable().optional(),
  }),
);

export type MediaRef = {
  mediaId?: string | null;
  src?: string | null;
  alt?: string | null;
};

export const headerSchema = z
  .object({
    kicker: optionalString,
    title: optionalString,
    subtitle: optionalString,
  })
  .optional()
  .nullable();

export const backgroundSchema = z.enum(["default", "alt"]).default("default");

export const buttonSchema = z.object({
  label: z.string().min(1, "Укажите текст кнопки"),
  href: z.string().min(1, "Укажите ссылку"),
  style: z.enum(["primary", "secondary"]).default("primary"),
});

export const heroClientSchema = z.object({
  variant: z.enum(["home", "sub", "service"]).default("home"),
  kicker: optionalString,
  title: z.string().min(1, "Нужен заголовок"),
  titleAccent: optionalString,
  lead: optionalString,
  buttons: z.array(buttonSchema).default([]),
  mascot: z.string().default("privet"),
  feats: z
    .array(
      z.object({
        icon: optionalString,
        text: z.string().min(1),
      }),
    )
    .default([]),
  rings: z.unknown().optional().nullable(),
  image: mediaRefSchema.optional(),
});

export const answerClientSchema = z.object({
  text: z.string().optional().default(""),
  html: optionalString,
  facts: z
    .array(
      z.object({
        value: z.string().min(1),
        label: z.string().min(1),
      }),
    )
    .default([]),
});

export const cardsClientSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  items: z
    .array(
      z.object({
        num: optionalString,
        icon: optionalString,
        title: z.string().min(1),
        text: optionalString,
        textHtml: optionalString,
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

export const stepsClientSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  variant: z.enum(["default", "av", "flow5", "k-steps"]).default("default").optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        text: z.string().default(""),
        result: z.string().default(""),
        icon: optionalString,
      }),
    )
    .default([]),
});

export const faqClientSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  items: z
    .array(
      z.object({
        question: z.string().min(1, "Нужен вопрос"),
        answer: z.string().optional().default(""),
        answerHtml: optionalString,
      }),
    )
    .default([]),
});

export const teamClientSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  people: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().default(""),
        quote: z.string().default(""),
        text: z.string().default(""),
        textHtml: optionalString,
        photo: mediaRefSchema.optional(),
        photoAlt: z.string().default(""),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        links: z
          .array(z.object({ label: z.string(), href: z.string() }))
          .optional(),
      }),
    )
    .default([]),
});

export const casesClientSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  variant: z.enum(["default", "portfolio"]).default("default").optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        tag: optionalString,
        text: z.string().default(""),
        textHtml: optionalString,
        result: optionalString,
        image: mediaRefSchema.optional(),
        href: optionalString,
        kicker: optionalString,
        more: optionalString,
      }),
    )
    .default([]),
});

export const ctaClientSchema = z.object({
  title: z.string().min(1),
  lead: optionalString,
  buttons: z.array(buttonSchema).default([]),
  rings: z.unknown().optional().nullable(),
  background: backgroundSchema,
});

export const textClientSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  layout: z.enum(["one", "two"]).default("one").optional(),
  markdown: z.string().default(""),
  html: optionalString,
});

export const widgetClientSchema = z.object({
  key: z.enum(["studio", "calcMini", "calcFull"]),
  htmlSnapshot: z.string().default(""),
});

export const rawHtmlClientSchema = z.object({
  html: z.string().default(""),
});

export const iconListClientSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  variant: z.enum(["plist-cards", "safe"]).default("plist-cards"),
  items: z
    .array(
      z.object({
        icon: optionalString,
        title: optionalString,
        textHtml: optionalString,
        text: optionalString,
      }),
    )
    .default([]),
});

export const offerClientSchema = z.object({
  header: headerSchema,
  background: backgroundSchema,
  items: z
    .array(
      z.object({
        kicker: optionalString,
        html: optionalString,
        price: optionalString,
        highlight: z.boolean().optional(),
      }),
    )
    .default([]),
});

export const beforeAfterClientSchema = z.object({
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

export const CLIENT_BLOCK_SCHEMAS = {
  hero: heroClientSchema,
  answer: answerClientSchema,
  cards: cardsClientSchema,
  steps: stepsClientSchema,
  faq: faqClientSchema,
  team: teamClientSchema,
  cases: casesClientSchema,
  cta: ctaClientSchema,
  text: textClientSchema,
  widget: widgetClientSchema,
  iconList: iconListClientSchema,
  offer: offerClientSchema,
  beforeAfter: beforeAfterClientSchema,
  rawHtml: rawHtmlClientSchema,
} as const;
