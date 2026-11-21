import { getLeadsApiConfig } from "@/server/leads/config";
import { fetchHubStats } from "@/server/hub-stats/fetch";
import type { HubStatsResult } from "@/server/hub-stats/types";
import type { Period } from "@/server/services/period";

/** GET {LEADS_BASE_URL}/api/hub/stats — HMAC HUB_LEADS_API_SECRET. */
export async function fetchLeadsHubStats(
  period: Period,
  fetchImpl?: typeof fetch,
): Promise<HubStatsResult> {
  const cfg = getLeadsApiConfig();
  if (!cfg) {
    return {
      status: "not_configured",
      code: "LEADS_NOT_CONFIGURED",
      message: "Лиды: не настроено (LEADS_BASE_URL / HUB_LEADS_API_SECRET)",
    };
  }
  return fetchHubStats({
    service: "leads",
    period,
    baseUrl: cfg.baseUrl,
    apiSecret: cfg.apiSecret,
    fetchImpl,
  });
}
