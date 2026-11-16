import { z } from "zod";

export const secretKindSchema = z.enum([
  "login",
  "api_key",
  "note",
  "db",
  "ssh",
  "telegram_bot",
]);

export const secretCreateSchema = z.object({
  title: z.string().min(1).max(200),
  kind: secretKindSchema,
  url: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  username: z.string().max(200).optional().nullable(),
  folder: z.string().max(120).optional().nullable(),
  tags: z.array(z.string().max(40)).default([]),
  note: z.string().max(4000).optional().nullable(),
  /** Секретные поля — не попадают в списки/аудит */
  secrets: z
    .object({
      password: z.string().optional(),
      apiKey: z.string().optional(),
      token: z.string().optional(),
      privateKey: z.string().optional(),
      extra: z.string().optional(),
    })
    .default({}),
});

export const secretUpdateSchema = secretCreateSchema.partial().extend({
  secrets: z
    .object({
      password: z.string().optional(),
      apiKey: z.string().optional(),
      token: z.string().optional(),
      privateKey: z.string().optional(),
      extra: z.string().optional(),
    })
    .optional(),
});
