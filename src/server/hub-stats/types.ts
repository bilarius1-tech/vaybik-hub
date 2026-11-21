import type { Period } from "@/server/services/period";

export type HubStatsService = "chat" | "leads";

export type HubStatsHealth = {
  ok: boolean;
  issues: string[];
  db?: unknown;
  worker?: unknown;
  collectors?: unknown[];
  watchdog?: unknown;
};

export type HubStatsPayload = {
  ok: true;
  service: HubStatsService;
  period: Period;
  timezone: string;
  generatedAt: string;
  kpi: Record<string, unknown>;
  series: Record<string, unknown>[];
  health: HubStatsHealth;
};

export type HubStatsOk = {
  status: "ok";
  data: HubStatsPayload;
};

export type HubStatsFail = {
  status: "unavailable" | "not_configured" | "bad_response";
  message: string;
  code: string;
};

export type HubStatsResult = HubStatsOk | HubStatsFail;
