import type { Client, ClientService, Prisma, Service } from "@prisma/client";
import { prisma } from "@/server/db";
import { upsertHubChatClient } from "@/server/chat/hub-client";
import {
  clientStatusToChat,
  clientStatusToServiceStatus,
} from "./status-map";

export type ClientWithServices = Client & {
  services: (ClientService & { service: Service })[];
};

export async function listClients(opts: {
  q?: string;
  status?: "active" | "paused" | "archived";
}): Promise<ClientWithServices[]> {
  const where: Prisma.ClientWhereInput = {};
  if (opts.status) where.status = opts.status;
  if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { contact: { contains: q, mode: "insensitive" } },
      { siteUrl: { contains: q, mode: "insensitive" } },
    ];
  }
  return prisma.client.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      services: { include: { service: true } },
    },
  });
}

export async function getClient(
  id: string,
): Promise<ClientWithServices | null> {
  return prisma.client.findUnique({
    where: { id },
    include: {
      services: { include: { service: true } },
    },
  });
}

/**
 * Подключить продукт (сейчас — Чат).
 * Без полусозданных записей: при ошибке API и без ручного externalId — ничего не пишем.
 */
export async function connectProduct(input: {
  clientId: string;
  serviceSlug: string;
  externalIdManual?: string | null;
  note?: string | null;
}): Promise<
  | { ok: true; clientService: ClientService & { service: Service } }
  | { ok: false; code: string; message: string }
> {
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
  });
  if (!client) {
    return { ok: false, code: "NOT_FOUND", message: "Клиент не найден" };
  }

  const service = await prisma.service.findFirst({
    where: {
      slug: input.serviceSlug,
      isProduct: true,
    },
  });
  if (!service) {
    return {
      ok: false,
      code: "NOT_PRODUCT",
      message: "Сервис не найден или не помечен как продукт",
    };
  }

  const existing = await prisma.clientService.findUnique({
    where: {
      clientId_serviceId: { clientId: client.id, serviceId: service.id },
    },
    include: { service: true },
  });
  if (existing) {
    return { ok: true, clientService: existing };
  }

  const manual = input.externalIdManual?.trim() || null;
  let externalId = manual;
  let lastSyncError: string | null = null;
  let lastSyncAt: Date | null = null;

  if (!manual) {
    if (service.slug === "chat") {
      const res = await upsertHubChatClient({
        hubClientId: client.id,
        name: client.name,
        status: clientStatusToChat(client.status),
      });
      if (!res.ok) {
        return { ok: false, code: res.code, message: res.message };
      }
      externalId = res.externalId;
      lastSyncAt = new Date();
    } else {
      return {
        ok: false,
        code: "MANUAL_REQUIRED",
        message: "Для этого продукта укажите externalId вручную",
      };
    }
  } else if (service.slug === "chat") {
    // Ручной ID: пробуем sync, но при сбое всё равно создаём запись с пометкой
    const res = await upsertHubChatClient({
      hubClientId: client.id,
      name: client.name,
      status: clientStatusToChat(client.status),
    });
    if (res.ok) {
      externalId = res.externalId;
      lastSyncAt = new Date();
    } else {
      lastSyncError = res.message;
      lastSyncAt = new Date();
    }
  }

  const created = await prisma.clientService.create({
    data: {
      clientId: client.id,
      serviceId: service.id,
      status: "setup",
      externalId,
      note: input.note ?? null,
      startedAt: new Date(),
      lastSyncAt,
      lastSyncError,
    },
    include: { service: true },
  });

  return { ok: true, clientService: created };
}

/** Повтор sync в чат для существующего ClientService */
export async function retrySyncClientService(
  clientServiceId: string,
): Promise<
  | { ok: true; clientService: ClientService & { service: Service } }
  | { ok: false; code: string; message: string }
> {
  const row = await prisma.clientService.findUnique({
    where: { id: clientServiceId },
    include: { client: true, service: true },
  });
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Подключение не найдено" };
  }
  if (row.service.slug !== "chat") {
    return {
      ok: false,
      code: "UNSUPPORTED",
      message: "Повтор sync пока только для Чата",
    };
  }

  const res = await upsertHubChatClient({
    hubClientId: row.client.id,
    name: row.client.name,
    status: clientStatusToChat(row.client.status),
  });

  if (!res.ok) {
    await prisma.clientService.update({
      where: { id: row.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: res.message,
      },
    });
    return { ok: false, code: res.code, message: res.message };
  }

  const updated = await prisma.clientService.update({
    where: { id: row.id },
    data: {
      externalId: res.externalId,
      lastSyncAt: new Date(),
      lastSyncError: null,
    },
    include: { service: true },
  });
  return { ok: true, clientService: updated };
}

/**
 * Смена статуса клиента: пишем в хаб, затем upsert во все подключённые продукты.
 * При сбое sync — lastSyncError, статус хаба не откатываем.
 */
export async function updateClientStatus(input: {
  clientId: string;
  status: "active" | "paused" | "archived";
}): Promise<ClientWithServices | null> {
  const existing = await prisma.client.findUnique({
    where: { id: input.clientId },
  });
  if (!existing) return null;

  await prisma.client.update({
    where: { id: input.clientId },
    data: { status: input.status },
  });

  const links = await prisma.clientService.findMany({
    where: { clientId: input.clientId },
    include: { service: true },
  });

  const desiredCs = clientStatusToServiceStatus(input.status);

  for (const link of links) {
    if (link.service.slug === "chat" && link.service.isProduct) {
      const res = await upsertHubChatClient({
        hubClientId: input.clientId,
        name: existing.name,
        status: clientStatusToChat(input.status),
      });
      await prisma.clientService.update({
        where: { id: link.id },
        data: {
          status: desiredCs,
          lastSyncAt: new Date(),
          lastSyncError: res.ok ? null : res.message,
          ...(res.ok ? { externalId: res.externalId } : {}),
        },
      });
    } else {
      await prisma.clientService.update({
        where: { id: link.id },
        data: { status: desiredCs },
      });
    }
  }

  return getClient(input.clientId);
}

export async function updateClientServiceStatus(input: {
  clientServiceId: string;
  status: "setup" | "active" | "paused" | "off";
}): Promise<
  | { ok: true; clientService: ClientService & { service: Service } }
  | { ok: false; code: string; message: string }
> {
  const row = await prisma.clientService.findUnique({
    where: { id: input.clientServiceId },
    include: { client: true, service: true },
  });
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Подключение не найдено" };
  }

  await prisma.clientService.update({
    where: { id: row.id },
    data: { status: input.status },
  });

  if (row.service.slug === "chat") {
    const chatStatus =
      input.status === "paused"
        ? "paused"
        : input.status === "off"
          ? "off"
          : "active";
    const res = await upsertHubChatClient({
      hubClientId: row.clientId,
      name: row.client.name,
      status: chatStatus,
    });
    const updated = await prisma.clientService.update({
      where: { id: row.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: res.ok ? null : res.message,
        ...(res.ok ? { externalId: res.externalId } : {}),
      },
      include: { service: true },
    });
    return { ok: true, clientService: updated };
  }

  const updated = await prisma.clientService.findUniqueOrThrow({
    where: { id: row.id },
    include: { service: true },
  });
  return { ok: true, clientService: updated };
}

export async function setManualExternalId(input: {
  clientServiceId: string;
  externalId: string;
}): Promise<ClientService & { service: Service }> {
  return prisma.clientService.update({
    where: { id: input.clientServiceId },
    data: {
      externalId: input.externalId,
      lastSyncError: "Указан вручную — синхронизация не подтверждена",
      lastSyncAt: new Date(),
    },
    include: { service: true },
  });
}
