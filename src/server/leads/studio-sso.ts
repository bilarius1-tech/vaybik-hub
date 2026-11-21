import { prisma } from "@/server/db";
import {
  buildSafeReturnUrl,
  issueSsoToken,
} from "@/server/chat/sso-token";
import { getLeadsSsoConfig } from "./config";

/** Путь в кабинете лидов: только /manage…, без // и ://. */
export function sanitizeLeadsManagePath(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let path = String(raw).trim();
  if (!path) return null;
  try {
    if (/^https?:\/\//i.test(path)) {
      const u = new URL(path);
      path = `${u.pathname}${u.search}`;
    }
  } catch {
    return null;
  }
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.includes("://")) return null;
  if (path.includes("\\") || path.includes("\0")) return null;
  if (!path.startsWith("/manage")) return null;
  if (path === "/manage/login" || path.startsWith("/manage/login?")) {
    return null;
  }
  return path.slice(0, 512);
}

export type StudioLeadsSsoResult =
  | { ok: true; ssoUrl: string; jti: string }
  | { ok: false; code: string; message: string; status: number };

/**
 * SSO студии в кабинет лидов (mode impersonate, hubClientId пустой).
 * Без reauth — достаточно сессии OWNER/ADMIN. Не продукт для клиентов хаба.
 */
export async function startStudioLeadsSso(input: {
  actor: { id: string; email: string };
  nextRaw: string | null;
}): Promise<StudioLeadsSsoResult> {
  const cfg = getLeadsSsoConfig();
  if (!cfg) {
    return {
      ok: false,
      code: "LEADS_SSO_NOT_CONFIGURED",
      message:
        "SSO не настроен: задайте LEADS_BASE_URL и HUB_LEADS_SSO_SECRET в .env",
      status: 503,
    };
  }

  const next = sanitizeLeadsManagePath(input.nextRaw) || "/manage";

  const returnUrl = buildSafeReturnUrl("/services");
  if (!returnUrl) {
    return {
      ok: false,
      code: "NO_APP_URL",
      message: "Задайте APP_URL в .env",
      status: 503,
    };
  }

  const { ssoUrl, jti, exp } = issueSsoToken({
    mode: "impersonate",
    userId: input.actor.id,
    email: input.actor.email,
    hubClientId: "",
    impersonatedBy: input.actor.id,
    returnUrl,
    aud: "leads",
    product: {
      baseUrl: cfg.baseUrl,
      ssoSecret: cfg.ssoSecret,
      notConfiguredCode: "LEADS_SSO_NOT_CONFIGURED",
      notConfiguredMessage:
        "SSO не настроен: задайте LEADS_BASE_URL и HUB_LEADS_SSO_SECRET",
    },
    serviceNext: next,
  });

  await prisma.ssoJti.create({
    data: {
      jti,
      mode: "impersonate",
      userId: input.actor.id,
      clientId: "",
      expiresAt: new Date(exp * 1000),
    },
  });

  return { ok: true, ssoUrl, jti };
}

/** Ссылка «Кабинет лидов» через SSO-старт хаба. */
export function leadsStudioSsoHref(leadsNextPath: string): string {
  const next = sanitizeLeadsManagePath(leadsNextPath) || "/manage";
  return `/sso/leads?next=${encodeURIComponent(next)}`;
}
