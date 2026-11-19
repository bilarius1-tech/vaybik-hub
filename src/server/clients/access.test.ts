import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/db", () => ({
  prisma: {
    client: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    clientMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    clientInvite: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    clientMailLog: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    clientService: { findUnique: vi.fn() },
    ssoJti: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      const { prisma } = await import("@/server/db");
      return fn(prisma);
    }),
  },
}));

vi.mock("@/server/chat/config", () => ({
  getChatSsoConfig: vi.fn(() => ({
    baseUrl: "https://chat-test.vaybik.ru",
    ssoSecret: "s".repeat(32),
  })),
}));

vi.mock("@/server/chat/sso-token", () => ({
  buildSafeReturnUrl: vi.fn(() => "http://127.0.0.1:3000/admin/my-services"),
  issueSsoToken: vi.fn(() => ({
    ssoUrl: "https://chat-test.vaybik.ru/sso?token=x",
    jti: "jti1",
    exp: Math.floor(Date.now() / 1000) + 60,
    token: "tok",
  })),
}));

vi.mock("@/server/crypto/password", async () => {
  const actual = await vi.importActual<typeof import("@/server/crypto/password")>(
    "@/server/crypto/password",
  );
  return {
    ...actual,
    hashPassword: vi.fn(async (p: string, min = 12) => {
      if (p.length < min) throw new Error(`short ${min}`);
      return `hash:${p}`;
    }),
  };
});

import { prisma } from "@/server/db";
import {
  acceptClientInvite,
  createClientInvite,
  startClientSelfSso,
} from "./access";

const mocked = prisma as unknown as {
  client: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  clientMember: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  clientInvite: {
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  clientService: { findUnique: ReturnType<typeof vi.fn> };
  ssoJti: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("client access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
  });

  it("createClientInvite отзывает старые и возвращает URL", async () => {
    mocked.client.findUnique.mockResolvedValue({ id: "c1", name: "Тест" });
    mocked.clientInvite.updateMany.mockResolvedValue({ count: 1 });
    mocked.clientInvite.create.mockResolvedValue({});
    mocked.clientInvite.findUniqueOrThrow.mockResolvedValue({
      id: "inv1",
      email: null,
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const res = await createClientInvite({
      clientId: "c1",
      email: null,
      createdBy: "u1",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.acceptUrl).toContain("/invite/");
    expect(mocked.clientInvite.updateMany).toHaveBeenCalled();
  });

  it("acceptClientInvite отклоняет короткий пароль", async () => {
    const res = await acceptClientInvite({
      token: "tok",
      email: "a@b.ru",
      password: "short",
    });
    expect(res).toEqual({
      ok: false,
      code: "WEAK_PASSWORD",
      message: "Пароль ≥ 10 символов",
    });
  });

  it("startClientSelfSso запрещает чужой ClientService", async () => {
    mocked.clientMember.findUnique.mockResolvedValue({
      userId: "u1",
      clientId: "c1",
    });
    mocked.clientService.findUnique.mockResolvedValue({
      id: "cs1",
      clientId: "cOTHER",
      externalId: "ext",
      service: { slug: "chat" },
    });
    const res = await startClientSelfSso({
      userId: "u1",
      email: "c@t.ru",
      clientServiceId: "cs1",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe("FORBIDDEN");
  });

  it("startClientSelfSso mode=client для своего чата", async () => {
    mocked.clientMember.findUnique.mockResolvedValue({
      userId: "u1",
      clientId: "c1",
    });
    mocked.clientService.findUnique.mockResolvedValue({
      id: "cs1",
      clientId: "c1",
      externalId: "ext",
      service: { slug: "chat" },
    });
    mocked.ssoJti.create.mockResolvedValue({});
    const res = await startClientSelfSso({
      userId: "u1",
      email: "c@t.ru",
      clientServiceId: "cs1",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ssoUrl).toContain("/sso?");
  });
});
