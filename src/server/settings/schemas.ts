import { z } from "zod";

export const brandSchema = z.object({
  name: z.string().min(1).max(80).default("Вайбик"),
  slogan: z.string().max(200).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  faviconUrl: z.string().max(500).optional().nullable(),
  themeVariant: z.enum(["A", "B", "C"]).default("A"),
});

export const siteContentSchema = z.object({
  status: z.enum(["coming_soon", "open"]).default("coming_soon"),
  banner: z.string().max(400).optional().nullable(),
  heroTitle: z.string().max(200).optional().nullable(),
  heroText: z.string().max(1000).optional().nullable(),
  aboutTitle: z.string().max(200).optional().nullable(),
  aboutText: z.string().max(4000).optional().nullable(),
  servicesTitle: z.string().max(200).optional().nullable(),
  servicesText: z.string().max(1000).optional().nullable(),
  contactsTitle: z.string().max(200).optional().nullable(),
});

const optionalUrl = z.union([z.string().url(), z.literal(""), z.null()]).optional();

export const contactsSchema = z.object({
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  telegram: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  social: z
    .object({
      vk: optionalUrl,
      youtube: optionalUrl,
      github: optionalUrl,
    })
    .optional()
    .default({}),
});

export const SETTINGS_KEYS = {
  brand: "brand",
  content: "site.content",
  contacts: "site.contacts",
} as const;
