import { z } from "zod";

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Укажите название клиента").max(200),
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
  name: z.string().trim().min(1, "Укажите название клиента").max(200).optional(),
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
  serviceSlug: z
    .string()
    .min(1, "Укажите сервис")
    .max(64)
    .default("chat"),
  /** Запасной ручной ID, если API чата недоступен */
  externalId: z
    .union([z.string().trim().min(1, "Укажите externalId"), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : v)),
  note: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
});

export const clientServiceStatusSchema = z.object({
  status: z.enum(["setup", "active", "paused", "off"], {
    message: "Некорректный статус подключения",
  }),
});

export const setExternalIdSchema = z.object({
  externalId: z
    .string()
    .trim()
    .min(1, "Укажите externalId")
    .max(120),
});

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, "Некорректная дата");

export const clientServicePeriodSchema = z.object({
  activeFrom: z.union([ymdSchema, z.null()]).optional(),
  activeUntil: z.union([ymdSchema, z.null()]).optional(),
  paymentNote: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) =>
      v === undefined ? undefined : v == null || v.trim() === "" ? null : v.trim(),
    ),
});

export const deleteClientSchema = z.object({
  confirmName: z
    .string()
    .trim()
    .min(1, "Введите название клиента для подтверждения"),
});
