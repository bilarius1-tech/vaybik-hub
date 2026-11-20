import { z } from "zod";
import { writeAudit } from "@/server/auth/audit";
import { prisma } from "@/server/db";
import { ymdToDate } from "@/server/clients/period";
import {
  hostFromSiteUrl,
  normalizeSiteHost,
  siteUrlFromHost,
} from "./normalize-host";

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
  .refine((v) => {
    try {
      ymdToDate(v);
      return true;
    } catch {
      return false;
    }
  }, "Некорректная дата");

export const landingClientBodySchema = z.object({
  externalId: z.string().trim().min(1, "Укажите externalId").max(120),
  name: z.string().trim().min(1, "Укажите название").max(200),
  siteHost: z.union([z.string(), z.null()]).optional(),
  contactNote: z.union([z.string(), z.null()]).optional(),
  status: z.literal("ACTIVE"),
  activeFrom: ymdSchema,
  activeUntil: ymdSchema,
});

export type LandingClientBody = z.infer<typeof landingClientBodySchema>;

export type RegisterLandingClientResult =
  | { ok: true; hubClientId: string; created: boolean }
  | { ok: false; code: string; message: string; status: number };

/**
 * Chat → Hub: DEMO→ACTIVE с лендинга.
 * Ищем по externalId (чат) или по домену siteHost; иначе создаём.
 * Идемпотентно: повтор → тот же hubClientId.
 */
export async function registerLandingClient(
  body: LandingClientBody,
  meta?: { ip?: string | null; userAgent?: string | null },
): Promise<RegisterLandingClientResult> {
  const host = normalizeSiteHost(body.siteHost ?? null);
  if (!host) {
    return {
      ok: false,
      code: "SITE_HOST_REQUIRED",
      message: "Укажите домен сайта (siteHost)",
      status: 400,
    };
  }

  const siteUrl = siteUrlFromHost(host);
  const contact =
    body.contactNote == null || String(body.contactNote).trim() === ""
      ? null
      : String(body.contactNote).trim().slice(0, 500);
  const activeFrom = ymdToDate(body.activeFrom);
  const activeUntil = ymdToDate(body.activeUntil);

  const chatService = await prisma.service.findFirst({
    where: { slug: "chat", isProduct: true },
  });
  if (!chatService) {
    return {
      ok: false,
      code: "CHAT_PRODUCT_MISSING",
      message: "Продукт «Чат» не найден в реестре сервисов",
      status: 503,
    };
  }

  const byExternal = await prisma.clientService.findFirst({
    where: {
      externalId: body.externalId,
      serviceId: chatService.id,
    },
    include: { client: true },
  });

  let clientId: string;
  let created = false;

  if (byExternal) {
    clientId = byExternal.clientId;
    await prisma.client.update({
      where: { id: clientId },
      data: {
        name: body.name,
        siteUrl,
        contact,
        status: "active",
        deleteIncomplete: false,
        deleteIncompleteError: null,
      },
    });
    await prisma.clientService.update({
      where: { id: byExternal.id },
      data: {
        status: "active",
        externalId: body.externalId,
        activeFrom,
        activeUntil,
        lastSyncAt: new Date(),
        lastSyncError: null,
        startedAt: byExternal.startedAt ?? new Date(),
      },
    });
  } else {
    const candidates = await prisma.client.findMany({
      where: {
        OR: [
          { siteUrl: siteUrl },
          { siteUrl: { contains: host, mode: "insensitive" } },
        ],
      },
      include: {
        services: { where: { serviceId: chatService.id } },
      },
    });
    const matched = candidates.find(
      (c) => hostFromSiteUrl(c.siteUrl) === host,
    );

    if (matched) {
      clientId = matched.id;
      await prisma.client.update({
        where: { id: clientId },
        data: {
          name: body.name,
          siteUrl,
          contact,
          status: "active",
          deleteIncomplete: false,
          deleteIncompleteError: null,
        },
      });
      const existingCs = matched.services[0];
      if (existingCs) {
        await prisma.clientService.update({
          where: { id: existingCs.id },
          data: {
            status: "active",
            externalId: body.externalId,
            activeFrom,
            activeUntil,
            lastSyncAt: new Date(),
            lastSyncError: null,
            startedAt: existingCs.startedAt ?? new Date(),
          },
        });
      } else {
        await prisma.clientService.create({
          data: {
            clientId,
            serviceId: chatService.id,
            status: "active",
            externalId: body.externalId,
            activeFrom,
            activeUntil,
            startedAt: new Date(),
            lastSyncAt: new Date(),
            lastSyncError: null,
          },
        });
      }
    } else {
      const client = await prisma.client.create({
        data: {
          name: body.name,
          siteUrl,
          contact,
          status: "active",
          services: {
            create: {
              serviceId: chatService.id,
              status: "active",
              externalId: body.externalId,
              activeFrom,
              activeUntil,
              startedAt: new Date(),
              lastSyncAt: new Date(),
              lastSyncError: null,
            },
          },
        },
      });
      clientId = client.id;
      created = true;
    }
  }

  await writeAudit({
    actorId: null,
    action: created
      ? "clients.landing_create"
      : "clients.landing_activate",
    entity: "Client",
    entityId: clientId,
    diff: {
      externalId: body.externalId,
      siteHost: host,
      activeFrom: body.activeFrom,
      activeUntil: body.activeUntil,
      created,
    },
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent ?? null,
  });

  return { ok: true, hubClientId: clientId, created };
}
