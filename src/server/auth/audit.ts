import { prisma } from "@/server/db";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      diff: input.diff ?? undefined,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
