import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, upsertHubChatClient } = vi.hoisted(() => ({
  prismaMock: {
    clientService: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  upsertHubChatClient: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: prismaMock }));
vi.mock("@/server/chat/hub-client", () => ({
  upsertHubChatClient,
  deleteHubChatClient: vi.fn(),
}));
vi.mock("@/server/backup/run", () => ({
  runAdminBackup: vi.fn(),
}));

import { updateClientServicePeriod } from "./service";

describe("updateClientServicePeriod → sync chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("продление пишет даты и шлёт ACTIVE в чат", async () => {
    prismaMock.clientService.findUnique.mockResolvedValue({
      id: "cs1",
      clientId: "c1",
      status: "active",
      activeFrom: new Date(Date.UTC(2026, 0, 1)),
      activeUntil: new Date(Date.UTC(2026, 10, 1)),
      paymentNote: null,
      client: { id: "c1", name: "Тест", status: "active" },
      service: { slug: "chat", isProduct: true, name: "Чат" },
    });
    prismaMock.clientService.update
      .mockResolvedValueOnce({
        id: "cs1",
        status: "active",
        activeFrom: new Date(Date.UTC(2026, 0, 1)),
        activeUntil: new Date(Date.UTC(2027, 10, 1)),
        paymentNote: "оплачено",
        service: { slug: "chat", isProduct: true, name: "Чат" },
      })
      .mockResolvedValueOnce({
        id: "cs1",
        status: "active",
        activeFrom: new Date(Date.UTC(2026, 0, 1)),
        activeUntil: new Date(Date.UTC(2027, 10, 1)),
        paymentNote: "оплачено",
        lastSyncAt: new Date(),
        lastSyncError: null,
        externalId: "ext1",
        service: { slug: "chat", isProduct: true, name: "Чат" },
      });

    upsertHubChatClient.mockResolvedValue({
      ok: true,
      externalId: "ext1",
    });

    const res = await updateClientServicePeriod({
      clientServiceId: "cs1",
      activeUntil: "2027-11-01",
      paymentNote: "оплачено",
    });

    expect(res.ok).toBe(true);
    expect(upsertHubChatClient).toHaveBeenCalledWith(
      expect.objectContaining({
        hubClientId: "c1",
        status: "ACTIVE",
        activeUntil: "2027-11-01",
        paymentNote: "оплачено",
      }),
    );
  });
});
