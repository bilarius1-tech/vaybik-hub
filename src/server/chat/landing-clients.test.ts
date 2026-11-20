import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, writeAudit } = vi.hoisted(() => {
  const prismaMock = {
    service: { findFirst: vi.fn() },
    clientService: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prismaMock, writeAudit: vi.fn(async () => undefined) };
});

vi.mock("@/server/db", () => ({ prisma: prismaMock }));
vi.mock("@/server/auth/audit", () => ({ writeAudit }));

import { registerLandingClient } from "./landing-clients";

const baseBody = {
  externalId: "chat-client-1",
  name: "Демо сайт",
  siteHost: "demo.example.ru",
  contactNote: "tg @demo",
  status: "ACTIVE" as const,
  activeFrom: "2026-11-20",
  activeUntil: "2026-11-27",
};

describe("registerLandingClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.service.findFirst.mockResolvedValue({
      id: "svc-chat",
      slug: "chat",
      isProduct: true,
    });
  });

  it("пустой siteHost → SITE_HOST_REQUIRED", async () => {
    const res = await registerLandingClient({
      ...baseBody,
      siteHost: null,
    });
    expect(res).toEqual({
      ok: false,
      code: "SITE_HOST_REQUIRED",
      message: "Укажите домен сайта (siteHost)",
      status: 400,
    });
    expect(prismaMock.client.create).not.toHaveBeenCalled();
  });

  it("создаёт клиента и ClientService chat", async () => {
    prismaMock.clientService.findFirst.mockResolvedValue(null);
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.client.create.mockResolvedValue({ id: "hub-new" });

    const res = await registerLandingClient(baseBody);
    expect(res).toEqual({
      ok: true,
      hubClientId: "hub-new",
      created: true,
    });
    expect(prismaMock.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Демо сайт",
          siteUrl: "https://demo.example.ru",
          status: "active",
          services: {
            create: expect.objectContaining({
              serviceId: "svc-chat",
              status: "active",
              externalId: "chat-client-1",
            }),
          },
        }),
      }),
    );
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "clients.landing_create",
        entityId: "hub-new",
      }),
    );
  });

  it("повтор по externalId — идемпотентно, без нового клиента", async () => {
    prismaMock.clientService.findFirst.mockResolvedValue({
      id: "cs1",
      clientId: "hub-1",
      startedAt: new Date("2026-11-01T00:00:00Z"),
      client: { id: "hub-1" },
    });
    prismaMock.client.update.mockResolvedValue({});
    prismaMock.clientService.update.mockResolvedValue({});

    const res1 = await registerLandingClient(baseBody);
    const res2 = await registerLandingClient(baseBody);

    expect(res1).toEqual({ ok: true, hubClientId: "hub-1", created: false });
    expect(res2).toEqual({ ok: true, hubClientId: "hub-1", created: false });
    expect(prismaMock.client.create).not.toHaveBeenCalled();
    expect(prismaMock.clientService.update).toHaveBeenCalledTimes(2);
  });

  it("находит существующего по домену и привязывает externalId", async () => {
    prismaMock.clientService.findFirst.mockResolvedValue(null);
    prismaMock.client.findMany.mockResolvedValue([
      {
        id: "hub-exist",
        siteUrl: "https://demo.example.ru",
        services: [],
      },
    ]);
    prismaMock.client.update.mockResolvedValue({});
    prismaMock.clientService.create.mockResolvedValue({});

    const res = await registerLandingClient(baseBody);
    expect(res).toEqual({
      ok: true,
      hubClientId: "hub-exist",
      created: false,
    });
    expect(prismaMock.client.create).not.toHaveBeenCalled();
    expect(prismaMock.clientService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "hub-exist",
          externalId: "chat-client-1",
          status: "active",
        }),
      }),
    );
  });
});
