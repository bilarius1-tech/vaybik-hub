import { getChatApiConfig } from "@/server/chat/config";
import { fetchHubStats } from "@/server/hub-stats/fetch";
import type { HubStatsResult } from "@/server/hub-stats/types";
import type { Period } from "@/server/services/period";

/** GET {CHAT_BASE_URL}/api/hub/stats — HMAC HUB_CHAT_API_SECRET. */
export async function fetchChatHubStats(
  period: Period,
  fetchImpl?: typeof fetch,
): Promise<HubStatsResult> {
  const cfg = getChatApiConfig();
  if (!cfg) {
    return {
      status: "not_configured",
      code: "CHAT_NOT_CONFIGURED",
      message: "Чат: не настроено (CHAT_BASE_URL / HUB_CHAT_API_SECRET)",
    };
  }
  return fetchHubStats({
    service: "chat",
    period,
    baseUrl: cfg.baseUrl,
    apiSecret: cfg.apiSecret,
    fetchImpl,
  });
}
