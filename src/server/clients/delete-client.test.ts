import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, runAdminBackup, deleteHubChatClient } = vi.hoisted(() => {
  const prismaMock = {
    client: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return {
    prismaMock,
    runAdminBackup: vi.fn(async () => ({
      id: "20261118T120000Z",
      dbFile: "/tmp/db.enc",
      uploadsFile: "/tmp/up.enc",
      pruned: 0,
      dbBytes: 1,
    })),
    deleteHubChatClient: vi.fn(),
  };
});

vi.mock("@/server/db", () => ({ prisma: prismaMock }));
vi.mock("@/server/backup/run", () => ({ runAdminBackup }));
vi.mock("@/server/chat/hub-client", () => ({
  deleteHubChatClient,
  upsertHubChatClient: vi.fn(),
}));

import { deleteClient } from "./service";

describe("deleteClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("не удаляет при несовпадении имени", async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: "c1",
      name: "Тест",
      services: [],
    });
    const res = await deleteClient({ clientId: "c1", confirmName: "Другой" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("NAME_MISMATCH");
    expect(runAdminBackup).not.toHaveBeenCalled();
  });

  it("при ошибке чата помечает incomplete и не удаляет", async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: "c1",
      name: "Тест",
      services: [
        {
          id: "cs1",
          service: { slug: "chat", name: "Чат", isProduct: true },
        },
      ],
    });
    deleteHubChatClient.mockResolvedValue({
      ok: false,
      code: "CHAT_UNAVAILABLE",
      message: "Чат недоступен (HTTP 503)",
    });
    prismaMock.client.update.mockResolvedValue({});

    const res = await deleteClient({ clientId: "c1", confirmName: "Тест" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("SERVICE_DELETE_FAILED");
      expect(res.incomplete).toBe(true);
      expect(res.backupId).toBe("20261118T120000Z");
    }
    expect(prismaMock.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deleteIncomplete: true }),
      }),
    );
    expect(prismaMock.client.delete).not.toHaveBeenCalled();
  });

  it("успех: бэкап → delete chat → delete hub", async () => {
    prismaMock.client.findUnique.mockResolvedValue({
      id: "c1",
      name: "Тест",
      services: [
        {
          id: "cs1",
          service: { slug: "chat", name: "Чат", isProduct: true },
        },
      ],
    });
    deleteHubChatClient.mockResolvedValue({ ok: true });
    prismaMock.client.delete.mockResolvedValue({});

    const res = await deleteClient({ clientId: "c1", confirmName: "Тест" });
    expect(res).toEqual({ ok: true, backupId: "20261118T120000Z" });
    expect(runAdminBackup).toHaveBeenCalled();
    expect(deleteHubChatClient).toHaveBeenCalledWith({ hubClientId: "c1" });
    expect(prismaMock.client.delete).toHaveBeenCalledWith({
      where: { id: "c1" },
    });
  });
});
