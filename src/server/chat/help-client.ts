import { getChatApiConfig } from "./config";
import { signHubBody } from "./signature";
import { helpMarkdownToHtml } from "@/server/services/help-markdown";

export type HubHelpPageRaw = {
  slug: string;
  title: string;
  order: number;
  updated: string;
  commit: string;
  markdown: string;
};

export type HubHelpPage = {
  slug: string;
  title: string;
  order: number;
  updated: string;
  commit: string;
  html: string;
};

export type FetchStudioHelpResult =
  | { ok: true; pages: HubHelpPage[] }
  | { ok: false; code: string; message: string };

const TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  pages: HubHelpPage[];
};

let cache: CacheEntry | null = null;

/** Сброс кэша (тесты). */
export function clearStudioHelpCache(): void {
  cache = null;
}

function parsePages(json: unknown): HubHelpPageRaw[] | null {
  if (!Array.isArray(json)) return null;
  const out: HubHelpPageRaw[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (
      typeof o.slug !== "string" ||
      typeof o.title !== "string" ||
      typeof o.markdown !== "string"
    ) {
      return null;
    }
    out.push({
      slug: o.slug.trim(),
      title: o.title.trim(),
      order: typeof o.order === "number" && Number.isFinite(o.order) ? o.order : 99,
      updated: typeof o.updated === "string" ? o.updated : "",
      commit: typeof o.commit === "string" ? o.commit : "",
      markdown: o.markdown,
    });
  }
  return out;
}

/**
 * GET {CHAT_BASE_URL}/api/hub/help
 * Подпись над пустым телом. Кэш 5 минут. MD→HTML на сервере.
 */
export async function fetchStudioHelpFromChat(): Promise<FetchStudioHelpResult> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { ok: true, pages: cache.pages };
  }

  const cfg = getChatApiConfig();
  if (!cfg) {
    return {
      ok: false,
      code: "CHAT_NOT_CONFIGURED",
      message: "Справка недоступна",
    };
  }

  const signature = signHubBody(cfg.apiSecret, "");
  const url = `${cfg.baseUrl}/api/hub/help`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Hub-Signature": signature,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return {
      ok: false,
      code: "CHAT_UNAVAILABLE",
      message: "Справка недоступна",
    };
  }

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      code: "CHAT_UNAVAILABLE",
      message: "Справка недоступна",
    };
  }

  const raw = parsePages(json);
  if (!raw) {
    return {
      ok: false,
      code: "CHAT_BAD_RESPONSE",
      message: "Справка недоступна",
    };
  }

  const pages = raw
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      order: p.order,
      updated: p.updated,
      commit: p.commit,
      html: helpMarkdownToHtml(p.markdown),
    }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ru"));

  cache = { expiresAt: now + CACHE_TTL_MS, pages };
  return { ok: true, pages };
}

/** Продукты с студийной справкой через /api/hub/help (пока только чат). */
export function serviceSupportsStudioHelp(service: {
  slug: string;
  isProduct: boolean;
}): boolean {
  return service.isProduct && service.slug === "chat";
}
