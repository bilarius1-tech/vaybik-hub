import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email("Некорректный email")
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, "Введите пароль"),
  /** «Запомнить меня» — долгая сессия (SESSION_REMEMBER_DAYS) */
  remember: z.boolean().optional().default(false),
});

export const twoFaSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().min(6).max(20),
});

export const reauthSchema = z.object({
  password: z.string().min(1, "Введите пароль"),
  /** Обязателен, только если у пользователя включена 2FA */
  code: z.string().max(20).optional().default(""),
});

export const setup2faConfirmSchema = z.object({
  secret: z.string().min(16),
  code: z.string().regex(/^\d{6}$/),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, "Пароль ≥ 12 символов"),
});

export const inviteSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  role: z.enum(["ADMIN", "PARTNER", "OWNER"]),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(12),
});

export const createClientInviteSchema = z.object({
  email: z
    .union([
      z
        .string()
        .email()
        .transform((v) => v.toLowerCase()),
      z.literal(""),
      z.null(),
    ])
    .optional(),
});

export const acceptClientInviteSchema = z.object({
  token: z.string().min(1),
  email: z
    .string()
    .email("Некорректный email")
    .transform((v) => v.toLowerCase())
    .optional(),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(10, "Пароль ≥ 10 символов"),
});
