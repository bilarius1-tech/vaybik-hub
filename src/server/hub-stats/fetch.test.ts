import { afterEach, describe, expect, it, vi } from "vitest";
import { clearHubStatsCache, fetchHubStats } from "@/server/hub-stats/fetch";
import { signHubBody } from "@/server/chat/signature";
import { verifyHubSignature } from "@/server/chat/signature";

afterEach(() => {
  clearHubStatsCache();
  vi.restoreAllMocks();
});

describe("fetchHubStats", () => {
  it("подписывает пустое тело и отдаёт ok", async () => {
    const secret = "test-secret";
    let seenSig = "";
    const fetchImpl: typeof fetch = async (_url, init) => {
      seenSig = String(
        (init?.headers as Record<string, string>)?.["X-Hub-Signature"] ?? "",
      );
      return new Response(
        JSON.stringify({
          ok: true,
          service: "chat",
          period: "day",
          timezone: "Europe/Moscow",
          generatedAt: "2026-11-21T18:00:00.000+03:00",
          kpi: { dialogs: 3 },
          series: [{ t: "2026-11-21T12:00:00+03:00", dialogs: 1 }],
          health: { ok: true, issues: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const res = await fetchHubStats({
      service: "chat",
      period: "day",
      baseUrl: "https://chat.example",
      apiSecret: secret,
      fetchImpl,
    });

    expect(verifyHubSignature(secret, "", seenSig)).toBe(true);
    expect(signHubBody(secret, "").startsWith("t=")).toBe(true);
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.data.kpi.dialogs).toBe(3);
      expect(res.data.series).toHaveLength(1);
    }
  });

  it("таймаут / сеть → unavailable", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("abort");
    };
    const res = await fetchHubStats({
      service: "leads",
      period: "week",
      baseUrl: "https://lead.example",
      apiSecret: "x",
      fetchImpl,
    });
    expect(res.status).toBe("unavailable");
    if (res.status !== "ok") expect(res.message).toContain("Лиды");
  });

  it("неполный ответ → bad_response", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: true, service: "chat" }), {
        status: 200,
      });
    const res = await fetchHubStats({
      service: "chat",
      period: "day",
      baseUrl: "https://chat.example",
      apiSecret: "x",
      fetchImpl,
    });
    expect(res.status).toBe("bad_response");
  });

  it("кэширует повторный вызов", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          ok: true,
          service: "chat",
          period: "day",
          timezone: "Europe/Moscow",
          generatedAt: "2026-11-21T18:00:00.000+03:00",
          kpi: {},
          series: [],
          health: { ok: true, issues: [] },
        }),
        { status: 200 },
      );
    };
    await fetchHubStats({
      service: "chat",
      period: "day",
      baseUrl: "https://chat.example",
      apiSecret: "x",
      fetchImpl,
    });
    await fetchHubStats({
      service: "chat",
      period: "day",
      baseUrl: "https://chat.example",
      apiSecret: "x",
      fetchImpl,
    });
    expect(calls).toBe(1);
  });
});

describe("stats-client not_configured", () => {
  it("чат без env", async () => {
    const prevBase = process.env.CHAT_BASE_URL;
    const prevSecret = process.env.HUB_CHAT_API_SECRET;
    delete process.env.CHAT_BASE_URL;
    delete process.env.HUB_CHAT_API_SECRET;
    const { fetchChatHubStats } = await import("@/server/chat/stats-client");
    const res = await fetchChatHubStats("day");
    expect(res.status).toBe("not_configured");
    if (prevBase) process.env.CHAT_BASE_URL = prevBase;
    else delete process.env.CHAT_BASE_URL;
    if (prevSecret) process.env.HUB_CHAT_API_SECRET = prevSecret;
    else delete process.env.HUB_CHAT_API_SECRET;
  });

  it("лиды без HUB_LEADS_API_SECRET", async () => {
    const prevBase = process.env.LEADS_BASE_URL;
    const prevSecret = process.env.HUB_LEADS_API_SECRET;
    process.env.LEADS_BASE_URL = "https://lead.example";
    delete process.env.HUB_LEADS_API_SECRET;
    const { fetchLeadsHubStats } = await import("@/server/leads/stats-client");
    const res = await fetchLeadsHubStats("day");
    expect(res.status).toBe("not_configured");
    if (prevBase) process.env.LEADS_BASE_URL = prevBase;
    else delete process.env.LEADS_BASE_URL;
    if (prevSecret) process.env.HUB_LEADS_API_SECRET = prevSecret;
    else delete process.env.HUB_LEADS_API_SECRET;
  });
});
