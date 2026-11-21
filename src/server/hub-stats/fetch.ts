import { signHubBody } from "@/server/chat/signature";
import type { Period } from "@/server/services/period";
import type {
  HubStatsPayload,
  HubStatsResult,
  HubStatsService,
} from "@/server/hub-stats/types";

const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 45_000;

type CacheEntry = {
  expiresAt: number;
  result: HubStatsResult;
};

const cache = new Map<string, CacheEntry>();

/** Сброс кэша (тесты). */
export function clearHubStatsCache(): void {
  cache.clear();
}

function cacheKey(service: HubStatsService, period: Period, baseUrl: string): string {
  return `${service}:${period}:${baseUrl}`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function parsePayload(
  json: unknown,
  expectService: HubStatsService,
  period: Period,
): HubStatsPayload | null {
  const o = asRecord(json);
  if (!o || o.ok !== true) return null;
  if (o.service !== expectService) return null;
  if (typeof o.generatedAt !== "string") return null;
  const kpi = asRecord(o.kpi) ?? {};
  const series = Array.isArray(o.series) ? o.series.filter(asRecord) as Record<string, unknown>[] : [];
  const healthRaw = asRecord(o.health);
  const health = {
    ok: healthRaw?.ok === true,
    issues: Array.isArray(healthRaw?.issues)
      ? (healthRaw!.issues as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    db: healthRaw?.db,
    worker: healthRaw?.worker,
    collectors: Array.isArray(healthRaw?.collectors) ? healthRaw!.collectors : undefined,
    watchdog: healthRaw?.watchdog,
  };
  return {
    ok: true,
    service: expectService,
    period: (o.period === "day" || o.period === "week" || o.period === "month"
      ? o.period
      : period) as Period,
    timezone: typeof o.timezone === "string" ? o.timezone : "Europe/Moscow",
    generatedAt: o.generatedAt,
    kpi,
    series,
    health,
  };
}

/**
 * GET {baseUrl}/api/hub/stats?period=…
 * Подпись над пустым телом. Таймаут 5 с. Кэш в памяти ~45 с.
 */
export async function fetchHubStats(opts: {
  service: HubStatsService;
  period: Period;
  baseUrl: string;
  apiSecret: string;
  /** Для тестов — подмена fetch */
  fetchImpl?: typeof fetch;
}): Promise<HubStatsResult> {
  const { service, period, baseUrl, apiSecret } = opts;
  const key = cacheKey(service, period, baseUrl);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.result;

  const signature = signHubBody(apiSecret, "");
  const url = `${baseUrl.replace(/\/$/, "")}/api/hub/stats?period=${period}`;
  const doFetch = opts.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(url, {
      method: "GET",
      headers: {
        "X-Hub-Signature": signature,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    const result: HubStatsResult = {
      status: "unavailable",
      code: "TIMEOUT_OR_NETWORK",
      message: service === "chat" ? "Чат недоступен" : "Лиды недоступны",
    };
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, result });
    return result;
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
    const result: HubStatsResult = {
      status: "unavailable",
      code: res.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR",
      message: service === "chat" ? "Чат недоступен" : "Лиды недоступны",
    };
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, result });
    return result;
  }

  const data = parsePayload(json, service, period);
  if (!data) {
    const result: HubStatsResult = {
      status: "bad_response",
      code: "BAD_RESPONSE",
      message: service === "chat" ? "Чат: неполный ответ" : "Лиды: неполный ответ",
    };
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, result });
    return result;
  }

  const result: HubStatsResult = { status: "ok", data };
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, result });
  return result;
}
