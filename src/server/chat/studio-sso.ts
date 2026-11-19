import { prisma } from "@/server/db";
import { getChatSsoConfig } from "./config";
import {
  buildSafeReturnUrl,
  issueSsoToken,
} from "./sso-token";

/** Путь в чате: только /manage…, без // и ://. */
export function sanitizeChatManagePath(
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

/**
 * Из /manage/clients/<chatClientId> → hub Client.id через externalId.
 * Иначе null (студия без конкретного клиента).
 */
export function parseChatClientIdFromNext(next: string): string | null {
  const m = next.match(/^\/manage\/clients\/([^/?#]+)\/?$/);
  if (!m?.[1]) return null;
  const id = decodeURIComponent(m[1]).trim();
  if (!id || id.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return id;
}

export type StudioSsoResult =
  | { ok: true; ssoUrl: string; jti: string; hubClientId: string | null }
  | { ok: false; code: string; message: string; status: number };

/**
 * SSO студии в чат (mode impersonate). Без reauth — достаточно сессии OWNER/ADMIN.
 */
export async function startStudioChatSso(input: {
  actor: { id: string; email: string };
  nextRaw: string | null;
}): Promise<StudioSsoResult> {
  if (!getChatSsoConfig()) {
    return {
      ok: false,
      code: "CHAT_SSO_NOT_CONFIGURED",
      message:
        "SSO не настроен: задайте CHAT_BASE_URL и HUB_CHAT_SSO_SECRET в .env",
      status: 503,
    };
  }

  const next = sanitizeChatManagePath(input.nextRaw) || "/manage";
  const chatClientId = parseChatClientIdFromNext(next);

  let hubClientId: string | null = null;
  if (chatClientId) {
    const cs = await prisma.clientService.findFirst({
      where: {
        externalId: chatClientId,
        service: { slug: "chat" },
      },
      select: { clientId: true },
    });
    hubClientId = cs?.clientId ?? null;
    // Неизвестный externalId — всё равно пускаем студию без привязки клиента
  }

  const returnPath = hubClientId
    ? `/clients/${hubClientId}`
    : "/clients";
  const returnUrl = buildSafeReturnUrl(returnPath);
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
    hubClientId: hubClientId ?? "",
    impersonatedBy: input.actor.id,
    returnUrl,
    chatNext: next,
  });

  await prisma.ssoJti.create({
    data: {
      jti,
      mode: "impersonate",
      userId: input.actor.id,
      // Пустая строка, если клиента нет (схема требует String)
      clientId: hubClientId ?? "",
      expiresAt: new Date(exp * 1000),
    },
  });

  return { ok: true, ssoUrl, jti, hubClientId };
}

/** Ссылка «Настроить» через SSO-старт хаба. */
export function chatStudioSsoHref(chatNextPath: string): string {
  const next = sanitizeChatManagePath(chatNextPath) || "/manage";
  return `/sso/chat?next=${encodeURIComponent(next)}`;
}

export function resolveChatManageSsoHref(
  manageUrlTemplate: string | null | undefined,
  externalId: string | null | undefined,
): string | null {
  if (!manageUrlTemplate || !externalId) return null;
  const filled = manageUrlTemplate.includes("{externalId}")
    ? manageUrlTemplate
        .split("{externalId}")
        .join(encodeURIComponent(externalId))
    : manageUrlTemplate;
  try {
    const u = new URL(filled);
    const path = `${u.pathname}${u.search}`;
    if (!path.startsWith("/manage")) return null;
    return chatStudioSsoHref(path);
  } catch {
    if (filled.startsWith("/manage")) return chatStudioSsoHref(filled);
    return null;
  }
}
