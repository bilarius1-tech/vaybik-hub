import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getChatApiConfig: () => ({
    baseUrl: "https://chat-test.example",
    apiSecret: "test-secret",
  }),
}));

import { deleteHubChatClient, upsertHubChatClient } from "./hub-client";

describe("hub-client contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("upsert шлёт ACTIVE + даты + paymentNote", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        hubClientId: "hub1",
        name: "Тест",
        status: "ACTIVE",
        activeFrom: "2026-01-01",
        activeUntil: "2026-12-31",
        paymentNote: "12 000 ₽ / год",
      });
      expect(String(init?.headers && (init.headers as Record<string, string>)["X-Hub-Signature"])).toMatch(
        /^t=\d+,v1=/,
      );
      return new Response(JSON.stringify({ externalId: "chat1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await upsertHubChatClient({
      hubClientId: "hub1",
      name: "Тест",
      status: "ACTIVE",
      activeFrom: "2026-01-01",
      activeUntil: "2026-12-31",
      paymentNote: "12 000 ₽ / год",
    });
    expect(res).toEqual({ ok: true, externalId: "chat1" });
  });

  it("upsert EXPIRED", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.status).toBe("EXPIRED");
      return new Response(JSON.stringify({ externalId: "chat1" }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await upsertHubChatClient({
      hubClientId: "hub1",
      name: "Тест",
      status: "EXPIRED",
      activeUntil: "2026-01-01",
    });
    expect(res.ok).toBe(true);
  });

  it("delete шлёт hubClientId; ошибка сервиса → ok:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: { code: "BACKUP_FAILED", message: "Нет ключа бэкапа" },
          }),
          { status: 503 },
        ),
      ),
    );
    const res = await deleteHubChatClient({ hubClientId: "hub1" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain("бэкапа");
    }
  });

  it("delete успех", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(url).toMatch(/\/api\/hub\/clients$/);
        expect(init?.method).toBe("DELETE");
        expect(JSON.parse(String(init?.body))).toEqual({ hubClientId: "hub1" });
        return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      }),
    );
    const res = await deleteHubChatClient({ hubClientId: "hub1" });
    expect(res).toEqual({ ok: true });
  });
});
