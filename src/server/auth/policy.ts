import { SESSION_TTL_MS } from "@/server/auth/constants";

type Env = Record<string, string | undefined>;

/** REQUIRE_2FA (по умолчанию true). 'false'/'0'/'no'/'off' — 2FA необязательна. */
export function isRequire2fa(env: Env = process.env): boolean {
  const v = (env.REQUIRE_2FA ?? "").trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(v);
}

/** Нужно ли принудительно отправить пользователя на /setup-2fa. */
export function needsSetup2fa(
  user: { role: string; totpEnabled: boolean },
  env: Env = process.env,
): boolean {
  return (
    isRequire2fa(env) &&
    (user.role === "OWNER" || user.role === "ADMIN") &&
    !user.totpEnabled
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** SESSION_REMEMBER_DAYS (по умолчанию 30, диапазон 1..365). */
export function rememberDays(env: Env = process.env): number {
  const n = Number.parseInt(env.SESSION_REMEMBER_DAYS ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(n, 365);
}

/** Срок жизни (и шаг скользящего продления) сессии. */
export function sessionTtlMs(remember: boolean, env: Env = process.env): number {
  return remember ? rememberDays(env) * DAY_MS : SESSION_TTL_MS;
}
