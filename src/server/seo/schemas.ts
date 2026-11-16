import { z } from "zod";

export const seoPageSchema = z.object({
  host: z.string().min(1).default("vaybik.ru"),
  path: z.string().min(1).regex(/^\//, "path должен начинаться с /"),
  title: z.string().max(120).optional().nullable(),
  description: z.string().max(320).optional().nullable(),
  canonical: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  robots: z.string().default("index,follow"),
  ogTitle: z.string().max(120).optional().nullable(),
  ogDescription: z.string().max(320).optional().nullable(),
  ogImage: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  twitterCard: z.string().optional().nullable(),
  jsonLd: z.unknown().optional().nullable(),
  inSitemap: z.boolean().default(true),
  priority: z.number().min(0).max(1).default(0.5),
  changefreq: z.string().default("weekly"),
});

export const seoCountersSchema = z.object({
  yandexWebmaster: z.string().optional().nullable(),
  yandexMetrika: z.string().optional().nullable(),
  googleSearchConsole: z.string().optional().nullable(),
  googleAnalytics: z.string().optional().nullable(),
});
