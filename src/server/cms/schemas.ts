import { z } from "zod";
import { BLOCK_TYPES, parseBlockData } from "./blocks";
import { pagePathSchema } from "./path";
import { redirectInputSchema } from "./redirects";

export const pageTemplateSchema = z.enum([
  "home",
  "default",
  "service",
  "calculator",
  "keysy",
]);

export const pageStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const pageCreateSchema = z.object({
  path: pagePathSchema,
  title: z.string().min(1).max(200),
  template: pageTemplateSchema.default("default"),
  status: pageStatusSchema.default("DRAFT"),
  sortOrder: z.number().int().default(0),
});

export const pageUpdateSchema = z.object({
  path: pagePathSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  template: pageTemplateSchema.optional(),
  status: pageStatusSchema.optional(),
  sortOrder: z.number().int().optional(),
  seoPageId: z.string().cuid().nullable().optional(),
});

export const blockCreateSchema = z
  .object({
    type: z.enum(BLOCK_TYPES),
    data: z.unknown(),
    isHidden: z.boolean().default(false),
    anchor: z.string().max(80).optional().nullable(),
    sortOrder: z.number().int().optional(),
  })
  .transform((v) => ({
    ...v,
    data: parseBlockData(v.type, v.data ?? {}),
  }));

export const blockUpdateSchema = z
  .object({
    type: z.enum(BLOCK_TYPES).optional(),
    data: z.unknown().optional(),
    isHidden: z.boolean().optional(),
    anchor: z.string().max(80).optional().nullable(),
    sortOrder: z.number().int().optional(),
    /** ISO-время для оптимистичной блокировки */
    updatedAt: z.string().datetime().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.data !== undefined && !v.type) {
      ctx.addIssue({
        code: "custom",
        message: "при обновлении data нужен type",
        path: ["type"],
      });
    }
  })
  .transform((v) => {
    if (v.data !== undefined && v.type) {
      return { ...v, data: parseBlockData(v.type, v.data) };
    }
    return v;
  });

export const blocksReorderSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
});

export const publishSchema = z.object({
  note: z.string().max(300).optional().nullable(),
});

const navItemBaseSchema = z.object({
  menu: z.enum(["HEADER", "FOOTER"]),
  parentId: z.string().cuid().nullable().optional(),
  label: z.string().min(1).max(120),
  url: z.string().max(500).nullable().optional(),
  pageId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isHidden: z.boolean().default(false),
  isHighlighted: z.boolean().default(false),
  openInNewTab: z.boolean().default(false),
});

export const navItemSchema = navItemBaseSchema.superRefine((v, ctx) => {
  const hasUrl = Boolean(v.url);
  const hasPage = Boolean(v.pageId);
  if (hasUrl === hasPage) {
    ctx.addIssue({
      code: "custom",
      message: "нужно ровно одно из: url или pageId",
      path: ["url"],
    });
  }
});

/** Частичное обновление пункта меню (без требования url XOR pageId) */
export const navItemPatchSchema = navItemBaseSchema.partial();

export const navReorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().cuid(),
      sortOrder: z.number().int(),
      parentId: z.string().cuid().nullable().optional(),
    }),
  ),
});

export { redirectInputSchema };
