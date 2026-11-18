import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, upsertHubChatClient } = vi.hoisted(() => ({
  prismaMock: {
    client: {
      findUnique: vi.fn(),
    },
    clientService: {
      findMany: vi.fn(),
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

import { syncClientProducts } from "./service";

describe("syncClientProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sync имени не меняет ClientService.status (setup остаётся)", async () => {
    const clientRow = {
      id: "c1",
      name: "Тест",
      status: "active" as const,
      services: [
        {
          id: "cs1",
          status: "setup" as const,
          activeFrom: null,
          activeUntil: null,
          paymentNote: null,
          service: { slug: "chat", isProduct: true, name: "Чат" },
        },
      ],
    };
    prismaMock.client.findUnique
      .mockResolvedValueOnce(clientRow)
      .mockResolvedValueOnce(clientRow);
    upsertHubChatClient.mockResolvedValue({ ok: true, externalId: "ext1" });
    prismaMock.clientService.update.mockResolvedValue({
      ...clientRow.services[0],
      lastSyncError: null,
      externalId: "ext1",
    });

    await syncClientProducts("c1");

    expect(upsertHubChatClient).toHaveBeenCalled();
    const updateArg = prismaMock.clientService.update.mock.calls[0]?.[0];
    expect(updateArg?.data?.status).toBeUndefined();
  });
});
