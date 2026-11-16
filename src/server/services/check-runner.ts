import type { Service } from "@prisma/client";
import { prisma } from "@/server/db";
import { runHealthCheck } from "@/server/services/health-check";
import { notifyEvent } from "@/server/services/telegram";

export async function checkService(service: Service): Promise<void> {
  if (!service.isDeployed || !service.healthUrl) {
    return;
  }

  const prevStatus = service.status;
  const result = await runHealthCheck({
    healthUrl: service.healthUrl,
    expectedStatus: service.expectedStatus,
    keyword: service.keyword,
    timeoutMs: service.timeoutMs,
  });

  await prisma.$transaction([
    prisma.healthCheck.create({
      data: {
        serviceId: service.id,
        status: result.status,
        httpStatus: result.httpStatus,
        responseMs: result.responseMs,
        error: result.error,
      },
    }),
    prisma.service.update({
      where: { id: service.id },
      data: {
        status: result.status,
        lastCheckedAt: new Date(),
        lastResponseMs: result.responseMs,
        certExpiresAt: result.certExpiresAt ?? service.certExpiresAt,
      },
    }),
  ]);

  if (prevStatus !== result.status) {
    if (result.status === "DOWN") {
      await notifyEvent({
        event: "service.down",
        entityId: service.id,
        text: `🔴 Сервис упал: ${service.name} (${service.url})\n${result.error || ""}`.trim(),
      });
    } else if (prevStatus === "DOWN" && (result.status === "UP" || result.status === "DEGRADED")) {
      await notifyEvent({
        event: "service.up",
        entityId: service.id,
        text: `🟢 Сервис снова онлайн: ${service.name} (${service.url})`,
      });
    }
  }

  if (result.certExpiresAt) {
    const days =
      (result.certExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (days < 14 && days > 0) {
      await notifyEvent({
        event: "cert.expiring",
        entityId: service.id,
        text: `⚠️ Сертификат ${service.name}: осталось ~${Math.floor(days)} дн. (${result.certExpiresAt.toISOString().slice(0, 10)})`,
      });
    }
  }
}

export async function checkAllDueServices(): Promise<number> {
  const services = await prisma.service.findMany({
    where: { isDeployed: true, healthUrl: { not: null } },
  });
  let n = 0;
  const now = Date.now();
  for (const s of services) {
    const due =
      !s.lastCheckedAt ||
      now - s.lastCheckedAt.getTime() >= s.intervalSec * 1000;
    if (!due) continue;
    await checkService(s);
    n += 1;
  }
  return n;
}
