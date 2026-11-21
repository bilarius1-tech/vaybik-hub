/**
 * Env для внутреннего сервиса «Лиды Профи/YouDo».
 * Без значений SSO/API выключены — запасных секретов в коде нет.
 */

export type LeadsSsoConfig = {
  baseUrl: string;
  ssoSecret: string;
};

export type LeadsApiConfig = {
  baseUrl: string;
  apiSecret: string;
};

function trimOrEmpty(v: string | undefined): string {
  return (v ?? "").trim();
}

/** Готовность SSO студии в кабинет лидов. */
export function getLeadsSsoConfig(): LeadsSsoConfig | null {
  const baseUrl = trimOrEmpty(process.env.LEADS_BASE_URL).replace(/\/$/, "");
  const ssoSecret = trimOrEmpty(process.env.HUB_LEADS_SSO_SECRET);
  if (!baseUrl || !ssoSecret) return null;
  return { baseUrl, ssoSecret };
}

/** Server-to-server: GET /api/hub/stats. Секрет HUB_LEADS_API_SECRET. */
export function getLeadsApiConfig(): LeadsApiConfig | null {
  const baseUrl = trimOrEmpty(process.env.LEADS_BASE_URL).replace(/\/$/, "");
  const apiSecret = trimOrEmpty(process.env.HUB_LEADS_API_SECRET);
  if (!baseUrl || !apiSecret) return null;
  return { baseUrl, apiSecret };
}

export function leadsSsoMissingKeys(): string[] {
  const missing: string[] = [];
  if (!trimOrEmpty(process.env.LEADS_BASE_URL)) missing.push("LEADS_BASE_URL");
  if (!trimOrEmpty(process.env.HUB_LEADS_SSO_SECRET)) {
    missing.push("HUB_LEADS_SSO_SECRET");
  }
  return missing;
}

export function leadsApiMissingKeys(): string[] {
  const missing: string[] = [];
  if (!trimOrEmpty(process.env.LEADS_BASE_URL)) missing.push("LEADS_BASE_URL");
  if (!trimOrEmpty(process.env.HUB_LEADS_API_SECRET)) {
    missing.push("HUB_LEADS_API_SECRET");
  }
  return missing;
}
