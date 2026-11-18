/**
 * Env для интеграции с продуктом «Чат».
 * Без значений функции выключены — запасных секретов в коде нет.
 */

export type ChatApiConfig = {
  baseUrl: string;
  apiSecret: string;
};

export type ChatSsoConfig = {
  baseUrl: string;
  ssoSecret: string;
};

function trimOrEmpty(v: string | undefined): string {
  return (v ?? "").trim();
}

/** Готовность API upsert клиентов (Подключить / синхронизация статуса). */
export function getChatApiConfig(): ChatApiConfig | null {
  const baseUrl = trimOrEmpty(process.env.CHAT_BASE_URL).replace(/\/$/, "");
  const apiSecret = trimOrEmpty(process.env.HUB_CHAT_API_SECRET);
  if (!baseUrl || !apiSecret) return null;
  return { baseUrl, apiSecret };
}

/** Готовность SSO «Войти как клиент» (Ф-B). */
export function getChatSsoConfig(): ChatSsoConfig | null {
  const baseUrl = trimOrEmpty(process.env.CHAT_BASE_URL).replace(/\/$/, "");
  const ssoSecret = trimOrEmpty(process.env.HUB_CHAT_SSO_SECRET);
  if (!baseUrl || !ssoSecret) return null;
  return { baseUrl, ssoSecret };
}

export function chatApiMissingKeys(): string[] {
  const missing: string[] = [];
  if (!trimOrEmpty(process.env.CHAT_BASE_URL)) missing.push("CHAT_BASE_URL");
  if (!trimOrEmpty(process.env.HUB_CHAT_API_SECRET)) {
    missing.push("HUB_CHAT_API_SECRET");
  }
  return missing;
}

export function chatSsoMissingKeys(): string[] {
  const missing: string[] = [];
  if (!trimOrEmpty(process.env.CHAT_BASE_URL)) missing.push("CHAT_BASE_URL");
  if (!trimOrEmpty(process.env.HUB_CHAT_SSO_SECRET)) {
    missing.push("HUB_CHAT_SSO_SECRET");
  }
  return missing;
}
