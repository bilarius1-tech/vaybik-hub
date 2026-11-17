import { z } from "zod";

export const dbConnectionCreateSchema = z.object({
  name: z.string().min(1).max(120),
  engine: z.literal("postgres").default("postgres"),
  host: z.string().min(1).max(253),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1).max(63),
  secretId: z.string().min(1),
  backupSchedule: z
    .string()
    .max(80)
    .regex(/^(\S+\s+){4}\S+$/, "Ожидается cron из 5 полей")
    .optional()
    .nullable(),
  retention: z.coerce.number().int().min(1).max(365).default(14),
});

export const dbConnectionUpdateSchema = dbConnectionCreateSchema
  .partial()
  .omit({ engine: true })
  .extend({
    secretId: z.string().min(1).optional(),
  });

export const tableRowsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  filter: z.string().max(200).optional(),
});

export const selectQuerySchema = z.object({
  sql: z.string().min(1).max(8000),
});

export const restoreBodySchema = z.object({
  /** Точное имя подключения или БД для подтверждения */
  confirmName: z.string().min(1).max(120),
  /** Только test — прод-цели запрещены на этой фазе */
  target: z.literal("test").default("test"),
});
