import { z } from "zod";

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  siteUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  contact: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
  status: z.enum(["active", "paused", "archived"]).default("active"),
});

export const clientUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  siteUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "" || v == null ? null : v)),
  contact: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) =>
      v === undefined ? undefined : v == null || v.trim() === "" ? null : v.trim(),
    ),
  status: z.enum(["active", "paused", "archived"]).optional(),
});

export const connectServiceSchema = z.object({
  serviceSlug: z.string().min(1).max(64).default("chat"),
  /** Запасной ручной ID, если API чата недоступен */
  externalId: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === "" ? null : v)),
  note: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
});

export const clientServiceStatusSchema = z.object({
  status: z.enum(["setup", "active", "paused", "off"]),
});

export const setExternalIdSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
});
