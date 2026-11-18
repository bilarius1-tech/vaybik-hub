import type { Client, ClientService, Prisma, Service } from "@prisma/client";
import { runAdminBackup } from "@/server/backup/run";
import {
  deleteHubChatClient,
  upsertHubChatClient,
} from "@/server/chat/hub-client";
import { prisma } from "@/server/db";
import { dateToYmd, todayMskYmd, ymdToDate } from "./period";
import { buildChatUpsertPayload } from "./sync-payload";
import { clientStatusToServiceStatus } from "./status-map";

export type ClientWithServices = Client & {
  services: (ClientService & { service: Service })[];
};

export type ListClientsOpts = {
  q?: string;
  status?: "active" | "paused" | "archived";
  /** Фильтр по сроку Чата */
  expiry?: "expiring" | "expired";
  sort?: "created" | "until_asc" | "until_desc";
  todayYmd?: string;
};

export async function listClients(
  opts: ListClientsOpts,
): Promise<ClientWithServices[]> {
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

  const rows = await prisma.client.findMany({
    where,
    include: {
      services: { include: { service: true } },
    },
  });

  const today = opts.todayYmd ?? todayMskYmd();
  let filtered = rows;
  if (opts.expiry === "expiring" || opts.expiry === "expired") {
    filtered = rows.filter((c) => {
      const chat = c.services.find((s) => s.service.slug === "chat");
      const until = dateToYmd(chat?.activeUntil ?? null);
      if (!until) return false;
      if (opts.expiry === "expired") return until < today;
      const left =
        (ymdToDate(until).getTime() - ymdToDate(today).getTime()) /
        86_400_000;
      return left >= 0 && left <= 7;
    });
  }

  const sort = opts.sort ?? "created";
  filtered.sort((a, b) => {
    if (sort === "created") {
      return b.createdAt.getTime() - a.createdAt.getTime();
    }
    const au = dateToYmd(
      a.services.find((s) => s.service.slug === "chat")?.activeUntil ?? null,
    );
    const bu = dateToYmd(
      b.services.find((s) => s.service.slug === "chat")?.activeUntil ?? null,
    );
    if (au == null && bu == null) return 0;
    if (au == null) return 1;
    if (bu == null) return -1;
    const cmp = au.localeCompare(bu);
    return sort === "until_asc" ? cmp : -cmp;
  });

  return filtered;
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

async function syncChatLink(
  client: Pick<Client, "id" | "name" | "status">,
  link: ClientService & { service: Service },
  opts?: { includePeriodNulls?: boolean },
): Promise<ClientService & { service: Service }> {
  if (link.service.slug !== "chat" || !link.service.isProduct) {
    return link;
  }
  const res = await upsertHubChatClient(
    buildChatUpsertPayload(client, link, {
      includePeriodNulls: opts?.includePeriodNulls,
    }),
  );
  return prisma.clientService.update({
    where: { id: link.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: res.ok ? null : res.message,
      ...(res.ok ? { externalId: res.externalId } : {}),
    },
    include: { service: true },
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

  const draftLink = {
    status: "setup" as const,
    activeFrom: null,
    activeUntil: null,
    paymentNote: null,
  };

  if (!manual) {
    if (service.slug === "chat") {
      const res = await upsertHubChatClient(
        buildChatUpsertPayload(client, draftLink),
      );
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
    const res = await upsertHubChatClient(
      buildChatUpsertPayload(client, draftLink),
    );
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

  const updated = await syncChatLink(row.client, row);
  if (updated.lastSyncError) {
    return {
      ok: false,
      code: "CHAT_UNAVAILABLE",
      message: updated.lastSyncError,
    };
  }
  return { ok: true, clientService: updated };
}

/**
 * Sync имени/карточки в продукты без смены ClientService.status
 * (иначе «Сохранить» карточки затирало setup → active).
 */
export async function syncClientProducts(
  clientId: string,
): Promise<ClientWithServices | null> {
  const client = await getClient(clientId);
  if (!client) return null;
  for (const link of client.services) {
    if (link.service.slug === "chat" && link.service.isProduct) {
      await syncChatLink(client, link);
    }
  }
  return getClient(clientId);
}

/**
 * Смена статуса клиента: пишем в хаб, затем upsert во все подключённые продукты
 * и выравниваем статус подключения (paused→paused, archived→off, active→active).
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
  const clientAfter = { ...existing, status: input.status };

  for (const link of links) {
    if (link.service.slug === "chat" && link.service.isProduct) {
      const withStatus = { ...link, status: desiredCs };
      const res = await upsertHubChatClient(
        buildChatUpsertPayload(clientAfter, withStatus),
      );
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

  const updatedStatus = await prisma.clientService.update({
    where: { id: row.id },
    data: { status: input.status },
    include: { service: true },
  });

  if (row.service.slug === "chat") {
    const synced = await syncChatLink(row.client, {
      ...updatedStatus,
      status: input.status,
    });
    return { ok: true, clientService: synced };
  }

  return { ok: true, clientService: updatedStatus };
}

export async function updateClientServicePeriod(input: {
  clientServiceId: string;
  activeFrom?: string | null;
  activeUntil?: string | null;
  paymentNote?: string | null;
}): Promise<
  | {
      ok: true;
      clientService: ClientService & { service: Service };
      previous: {
        activeFrom: string | null;
        activeUntil: string | null;
        paymentNote: string | null;
      };
    }
  | { ok: false; code: string; message: string }
> {
  const row = await prisma.clientService.findUnique({
    where: { id: input.clientServiceId },
    include: { client: true, service: true },
  });
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Подключение не найдено" };
  }

  const previous = {
    activeFrom: dateToYmd(row.activeFrom),
    activeUntil: dateToYmd(row.activeUntil),
    paymentNote: row.paymentNote,
  };

  const data: Prisma.ClientServiceUpdateInput = {};
  if (input.activeFrom !== undefined) {
    data.activeFrom =
      input.activeFrom == null ? null : ymdToDate(input.activeFrom);
  }
  if (input.activeUntil !== undefined) {
    data.activeUntil =
      input.activeUntil == null ? null : ymdToDate(input.activeUntil);
  }
  if (input.paymentNote !== undefined) {
    data.paymentNote = input.paymentNote;
  }

  const updated = await prisma.clientService.update({
    where: { id: row.id },
    data,
    include: { service: true },
  });

  if (row.service.slug === "chat") {
    const synced = await syncChatLink(row.client, updated, {
      includePeriodNulls: true,
    });
    return { ok: true, clientService: synced, previous };
  }

  return { ok: true, clientService: updated, previous };
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

export type DeleteClientResult =
  | { ok: true; backupId: string }
  | {
      ok: false;
      code: string;
      message: string;
      backupId?: string;
      incomplete?: boolean;
    };

/**
 * Удаление клиента: бэкап хаба → delete в каждый подключённый продукт →
 * только после успеха удаляем в хабе. При сбое — deleteIncomplete.
 */
export async function deleteClient(input: {
  clientId: string;
  confirmName: string;
}): Promise<DeleteClientResult> {
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    include: { services: { include: { service: true } } },
  });
  if (!client) {
    return { ok: false, code: "NOT_FOUND", message: "Клиент не найден" };
  }
  if (input.confirmName.trim() !== client.name) {
    return {
      ok: false,
      code: "NAME_MISMATCH",
      message: "Название не совпадает — удаление отменено",
    };
  }

  let backupId: string;
  try {
    const backup = await runAdminBackup();
    backupId = backup.id;
  } catch (err) {
    return {
      ok: false,
      code: "BACKUP_FAILED",
      message:
        err instanceof Error
          ? `Бэкап хаба не удался: ${err.message}`
          : "Бэкап хаба не удался",
    };
  }

  const failures: string[] = [];
  for (const link of client.services) {
    if (!link.service.isProduct) continue;
    if (link.service.slug === "chat") {
      const res = await deleteHubChatClient({ hubClientId: client.id });
      if (!res.ok) {
        failures.push(`Чат: ${res.message}`);
      }
    } else {
      failures.push(
        `${link.service.name}: удаление в сервисе ещё не реализовано`,
      );
    }
  }

  if (failures.length > 0) {
    const message = failures.join("; ");
    await prisma.client.update({
      where: { id: client.id },
      data: {
        deleteIncomplete: true,
        deleteIncompleteError: message,
      },
    });
    return {
      ok: false,
      code: "SERVICE_DELETE_FAILED",
      message,
      backupId,
      incomplete: true,
    };
  }

  await prisma.client.delete({ where: { id: client.id } });
  return { ok: true, backupId };
}
