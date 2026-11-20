import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signHubBody } from "@/server/chat/signature";

const { registerLandingClient, getHubChatApiSecret } = vi.hoisted(() => ({
  registerLandingClient: vi.fn(),
  getHubChatApiSecret: vi.fn(),
}));

vi.mock("@/server/chat/landing-clients", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/chat/landing-clients")
  >("@/server/chat/landing-clients");
  return {
    ...actual,
    registerLandingClient,
  };
});
vi.mock("@/server/chat/config", () => ({
  getHubChatApiSecret,
}));

import { POST } from "./route";

const secret = "test-hub-chat-secret";
const bodyObj = {
  externalId: "chat-1",
  name: "Сайт",
  siteHost: "site.ru",
  contactNote: null,
  status: "ACTIVE",
  activeFrom: "2026-11-20",
  activeUntil: "2026-11-27",
};

function makeReq(opts: {
  body: string;
  signature?: string | null;
}): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (opts.signature !== null) {
    headers.set(
      "X-Hub-Signature",
      opts.signature ?? signHubBody(secret, opts.body),
    );
  }
  return new NextRequest("http://localhost/admin/api/chat/landing-clients", {
    method: "POST",
    headers,
    body: opts.body,
  });
}

describe("POST /api/chat/landing-clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHubChatApiSecret.mockReturnValue(secret);
  });

  it("неверный секрет → 401", async () => {
    const raw = JSON.stringify(bodyObj);
    const badSig = signHubBody("wrong-secret", raw);
    const res = await POST(makeReq({ body: raw, signature: badSig }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(registerLandingClient).not.toHaveBeenCalled();
  });

  it("без подписи → 401", async () => {
    const raw = JSON.stringify(bodyObj);
    const res = await POST(makeReq({ body: raw, signature: null }));
    expect(res.status).toBe(401);
  });

  it("успех → hubClientId", async () => {
    registerLandingClient.mockResolvedValue({
      ok: true,
      hubClientId: "hub-42",
      created: true,
    });
    const raw = JSON.stringify(bodyObj);
    const res = await POST(makeReq({ body: raw }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hubClientId: "hub-42" });
  });

  it("секрет не задан → 503", async () => {
    getHubChatApiSecret.mockReturnValue(null);
    const raw = JSON.stringify(bodyObj);
    const res = await POST(makeReq({ body: raw }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("HUB_NOT_CONFIGURED");
  });
});
