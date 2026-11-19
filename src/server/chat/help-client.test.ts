import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  getChatApiConfig: () => ({
    baseUrl: "https://chat-test.example",
    apiSecret: "test-secret",
  }),
}));

import {
  clearStudioHelpCache,
  fetchStudioHelpFromChat,
  serviceSupportsStudioHelp,
} from "./help-client";

describe("help-client", () => {
  beforeEach(() => {
    clearStudioHelpCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearStudioHelpCache();
  });

  it("GET /api/hub/help с подписью над пустым телом; MD→HTML; кэш", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      expect(init?.body).toBeUndefined();
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-Hub-Signature"]).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
      return new Response(
        JSON.stringify([
          {
            slug: "02-b",
            title: "B",
            order: 2,
            updated: "2026-11-19",
            commit: "abc",
            markdown: "## Hello\n\n**world**",
          },
          {
            slug: "01-a",
            title: "A",
            order: 1,
            updated: "2026-11-18",
            commit: "def",
            markdown: "# First",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchStudioHelpFromChat();
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.pages.map((p) => p.slug)).toEqual(["01-a", "02-b"]);
    expect(first.pages[0]?.html).toContain("<h1");
    expect(first.pages[1]?.html).toContain("<strong>world</strong>");
    expect(first.pages[0]?.html).not.toContain("markdown");
    expect(JSON.stringify(first.pages)).not.toContain('"markdown"');

    const second = await fetchStudioHelpFromChat();
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ошибка чата → Справка недоступна", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const res = await fetchStudioHelpFromChat();
    expect(res).toEqual({
      ok: false,
      code: "CHAT_UNAVAILABLE",
      message: "Справка недоступна",
    });
  });

  it("serviceSupportsStudioHelp только для продукта chat", () => {
    expect(
      serviceSupportsStudioHelp({ slug: "chat", isProduct: true }),
    ).toBe(true);
    expect(
      serviceSupportsStudioHelp({ slug: "chat", isProduct: false }),
    ).toBe(false);
    expect(
      serviceSupportsStudioHelp({ slug: "lead", isProduct: true }),
    ).toBe(false);
  });
});
