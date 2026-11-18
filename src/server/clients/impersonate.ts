import { prisma } from "@/server/db";
import {
  buildSafeReturnUrl,
  issueSsoToken,
} from "@/server/chat/sso-token";
import { getChatSsoConfig } from "@/server/chat/config";

export type ImpersonateResult =
  | { ok: true; ssoUrl: string; jti: string }
  | { ok: false; code: string; message: string };

/**
 * Выпуск SSO impersonate. Токен только в ssoUrl для 302 — не логировать.
 * В БД пишем только jti.
 */
export async function startClientImpersonate(input: {
  clientId: string;
  actor: { id: string; email: string };
}): Promise<ImpersonateResult> {
  if (!getChatSsoConfig()) {
    return {
      ok: false,
      code: "CHAT_SSO_NOT_CONFIGURED",
      message:
        "SSO не настроен: задайте CHAT_BASE_URL и HUB_CHAT_SSO_SECRET в .env",
    };
  }

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    include: {
      services: { include: { service: true } },
    },
  });
  if (!client) {
    return { ok: false, code: "NOT_FOUND", message: "Клиент не найден" };
  }

  const chat = client.services.find((s) => s.service.slug === "chat");
  if (!chat) {
    return {
      ok: false,
      code: "NOT_CONNECTED",
      message: "Сначала подключите продукт «Чат»",
    };
  }
  if (!chat.externalId) {
    return {
      ok: false,
      code: "NO_EXTERNAL_ID",
      message: "У подключения Чата нет externalId",
    };
  }

  const returnUrl = buildSafeReturnUrl(`/clients/${client.id}`);
  if (!returnUrl) {
    return {
      ok: false,
      code: "NO_APP_URL",
      message: "Задайте APP_URL в .env",
    };
  }

  const { ssoUrl, jti, exp } = issueSsoToken({
    mode: "impersonate",
    userId: input.actor.id,
    email: input.actor.email,
    hubClientId: client.id,
    impersonatedBy: input.actor.id,
    returnUrl,
  });

  await prisma.ssoJti.create({
    data: {
      jti,
      mode: "impersonate",
      userId: input.actor.id,
      clientId: client.id,
      expiresAt: new Date(exp * 1000),
    },
  });

  return { ok: true, ssoUrl, jti };
}
