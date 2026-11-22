import { z } from "zod";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optStr = (max: number) =>
  z.preprocess(
    emptyToNull,
    z.string().max(max).nullable().optional(),
  );

const optUrl = z.preprocess(
  emptyToNull,
  z.union([z.string().url(), z.null()]).optional(),
);

export const serviceSeoUpdateSchema = z.object({
  title: optStr(120),
  description: optStr(320),
  canonical: optUrl,
  robots: z.string().min(1).max(120).optional(),
  ogTitle: optStr(120),
  ogDescription: optStr(320),
  ogImage: optUrl,
  twitterCard: optStr(64),
  jsonLd: z.unknown().optional().nullable(),
  yandexMetrika: optStr(64),
  yandexWebmaster: optStr(128),
  googleSearchConsole: optStr(128),
  googleAnalytics: optStr(64),
  robotsTxt: optStr(50_000),
  llmsTxt: optStr(50_000),
  sitemapUrl: optUrl,
});

export type ServiceSeoUpdateInput = z.infer<typeof serviceSeoUpdateSchema>;

export function parseJsonLdField(raw: unknown): unknown {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    return JSON.parse(t) as unknown;
  }
  return raw;
}
