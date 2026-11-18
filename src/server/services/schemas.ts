import { z } from "zod";

export const serviceUpsertSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "slug: латиница, цифры, дефис"),
  name: z.string().min(1).max(120),
  url: z.string().url(),
  description: z.string().max(2000).optional().nullable(),
  icon: z.string().max(8).optional().nullable(),
  type: z.enum(["DOCKER", "EXTERNAL", "STATIC"]).default("DOCKER"),
  containerNames: z.array(z.string()).default([]),
  composeProject: z.string().max(120).optional().nullable(),
  repoUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  branch: z.string().max(120).optional().nullable(),
  healthUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  keyword: z.string().max(200).optional().nullable(),
  intervalSec: z.number().int().min(30).max(3600).default(60),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
  isPublic: z.boolean().default(false),
  isDeployed: z.boolean().default(true),
  isProduct: z.boolean().default(false),
  publicPagePath: z.string().max(200).optional().nullable(),
  // Шаблон с {externalId} — не строгий URL
  manageUrl: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
  sortOrder: z.number().int().default(0),
  tags: z.array(z.string()).default([]),
});

export const notificationRuleSchema = z.object({
  event: z.string().min(1),
  chatIds: z.array(z.string().min(1)).min(1),
  isActive: z.boolean().default(true),
  throttleMin: z.number().int().min(1).max(1440).default(10),
  quietStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  quietEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
});

export const traefikLabelsSchema = z.object({
  subdomain: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  network: z.string().optional(),
  certresolver: z.string().optional(),
});
