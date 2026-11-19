import { prisma } from "@/server/db";
import { createClientInvite } from "@/server/clients/access";
import {
  dateToYmd,
  daysRemaining,
  formatYmdRu,
  todayMskYmd,
} from "@/lib/period-ymd";
import { renderClientInviteMessage } from "@/server/clients/invite-message";
import { cabinetLoginUrl, getMailConfig, isMailConfigured } from "@/server/mail/config";
import { sendMail } from "@/server/mail/send";
import {
  expiredMail,
  expirySoonMail,
  inviteMail,
  testMail,
} from "@/server/mail/template";

export type ClientMailKind =
  | "invite"
  | "expiry_7"
  | "expiry_1"
  | "expired"
  | "test";

export async function resolveClientNotifyEmail(
  clientId: string,
): Promise<string | null> {
  const member = await prisma.clientMember.findFirst({
    where: { clientId, user: { isBlocked: false } },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (member?.user.email) return member.user.email.toLowerCase();

  const now = new Date();
  const invite = await prisma.clientInvite.findFirst({
    where: {
      clientId,
      email: { not: null },
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  return invite?.email?.toLowerCase() || null;
}

async function alreadySentPeriod(input: {
  clientServiceId: string;
  kind: ClientMailKind;
  periodKey: string;
}): Promise<boolean> {
  const row = await prisma.clientMailLog.findFirst({
    where: {
      clientServiceId: input.clientServiceId,
      kind: input.kind,
      periodKey: input.periodKey,
      status: "sent",
    },
  });
  return Boolean(row);
}

async function writeLog(input: {
  clientId: string;
  clientServiceId?: string | null;
  kind: ClientMailKind;
  toEmail: string;
  subject: string;
  periodKey?: string | null;
  inviteId?: string | null;
  status: "sent" | "failed";
  error?: string | null;
}) {
  try {
    await prisma.clientMailLog.create({
      data: {
        clientId: input.clientId,
        clientServiceId: input.clientServiceId || null,
        kind: input.kind,
        toEmail: input.toEmail,
        subject: input.subject,
        periodKey: input.periodKey || null,
        inviteId: input.inviteId || null,
        status: input.status,
        error: input.error || null,
      },
    });
  } catch (err) {
    // unique period_sent — гонка cron: считаем уже отправленным
    const msg = err instanceof Error ? err.message : String(err);
    if (!/ClientMailLog_period_sent_key|Unique constraint/i.test(msg)) {
      console.warn("[mail] log write failed", msg);
    }
  }
}

/** Создать/перевыпустить invite и отправить письмо. */
export async function sendClientInviteEmail(input: {
  clientId: string;
  email?: string | null;
  actorId: string;
}): Promise<
  | { ok: true; to: string; acceptUrl: string; inviteId: string }
  | { ok: false; code: string; message: string }
> {
  if (!isMailConfigured()) {
    return {
      ok: false,
      code: "MAIL_NOT_CONFIGURED",
      message: "Почта не настроена — скопируйте ссылку вручную",
    };
  }

  let email = input.email?.trim().toLowerCase() || null;
  if (!email) email = await resolveClientNotifyEmail(input.clientId);
  if (!email) {
    return {
      ok: false,
      code: "EMAIL_REQUIRED",
      message: "Укажите email клиента",
    };
  }

  const invite = await createClientInvite({
    clientId: input.clientId,
    email,
    createdBy: input.actorId,
  });
  if (!invite.ok) {
    return { ok: false, code: invite.code, message: invite.message };
  }

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: input.clientId },
    select: { name: true, contact: true, siteUrl: true },
  });
  const bodyText = await renderClientInviteMessage({
    contactName: client.contact,
    siteUrl: client.siteUrl,
    inviteUrl: invite.acceptUrl,
    loginUrl: cabinetLoginUrl(),
  });
  const content = inviteMail({
    clientName: client.name,
    bodyText,
    inviteUrl: invite.acceptUrl,
    loginUrl: cabinetLoginUrl(),
  });
  const sent = await sendMail({ to: email, content });
  await writeLog({
    clientId: input.clientId,
    kind: "invite",
    toEmail: email,
    subject: content.subject,
    inviteId: invite.inviteId,
    status: sent.ok ? "sent" : "failed",
    error: sent.ok ? null : sent.message,
  });
  if (!sent.ok) {
    return { ok: false, code: sent.code, message: sent.message };
  }
  return {
    ok: true,
    to: email,
    acceptUrl: invite.acceptUrl,
    inviteId: invite.inviteId,
  };
}

/** Тестовое письмо админу (MAIL_TEST_TO или email сессии). */
export async function sendTestMailTo(input: {
  to: string;
  clientId?: string | null;
}): Promise<
  { ok: true; to: string } | { ok: false; code: string; message: string }
> {
  if (!isMailConfigured()) {
    return {
      ok: false,
      code: "MAIL_NOT_CONFIGURED",
      message: "Почта не настроена (SMTP_* в .env)",
    };
  }
  const to =
    getMailConfig()?.testTo?.trim().toLowerCase() ||
    input.to.trim().toLowerCase();
  const content = testMail({ loginUrl: cabinetLoginUrl() });
  const sent = await sendMail({ to, content });
  if (input.clientId) {
    await writeLog({
      clientId: input.clientId,
      kind: "test",
      toEmail: to,
      subject: content.subject,
      status: sent.ok ? "sent" : "failed",
      error: sent.ok ? null : sent.message,
    });
  }
  if (!sent.ok) {
    return { ok: false, code: sent.code, message: sent.message };
  }
  return { ok: true, to };
}

export async function setClientEmailNotify(
  clientId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return { ok: false, code: "NOT_FOUND", message: "Клиент не найден" };
  }
  await prisma.client.update({
    where: { id: clientId },
    data: { emailNotifyEnabled: enabled },
  });
  return { ok: true };
}

type PeriodKind = "expiry_7" | "expiry_1" | "expired";

/** left = daysRemaining(activeUntil, today). expired при left===-1 (утро activeUntil+1). */
export function periodKindForDaysLeft(left: number): PeriodKind | null {
  if (left === 7) return "expiry_7";
  if (left === 1) return "expiry_1";
  if (left === -1) return "expired";
  return null;
}

/** Утренний cron MSK: срок 7 / 1 / истёк (activeUntil+1). */
export async function runClientMailCron(todayYmd = todayMskYmd()): Promise<{
  checked: number;
  sent: number;
  skipped: number;
}> {
  if (!isMailConfigured()) {
    return { checked: 0, sent: 0, skipped: 0 };
  }

  const rows = await prisma.clientService.findMany({
    where: {
      activeUntil: { not: null },
      client: { emailNotifyEnabled: true, status: "active" },
      status: { in: ["setup", "active"] },
    },
    include: {
      client: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const cs of rows) {
    const until = dateToYmd(cs.activeUntil);
    if (!until) {
      skipped += 1;
      continue;
    }
    const left = daysRemaining(until, todayYmd);
    const kind = periodKindForDaysLeft(left);
    if (!kind) {
      skipped += 1;
      continue;
    }
    if (await alreadySentPeriod({ clientServiceId: cs.id, kind, periodKey: until })) {
      skipped += 1;
      continue;
    }
    const to = await resolveClientNotifyEmail(cs.clientId);
    if (!to) {
      skipped += 1;
      continue;
    }

    const untilRu = formatYmdRu(until);
    const content =
      kind === "expired"
        ? expiredMail({
            clientName: cs.client.name,
            serviceName: cs.service.name,
            untilRu,
            loginUrl: cabinetLoginUrl(),
          })
        : expirySoonMail({
            clientName: cs.client.name,
            serviceName: cs.service.name,
            untilRu,
            daysLeft: kind === "expiry_7" ? 7 : 1,
            loginUrl: cabinetLoginUrl(),
          });

    const result = await sendMail({ to, content });
    await writeLog({
      clientId: cs.clientId,
      clientServiceId: cs.id,
      kind,
      toEmail: to,
      subject: content.subject,
      periodKey: until,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.message,
    });
    if (result.ok) sent += 1;
    else skipped += 1;
  }

  return { checked: rows.length, sent, skipped };
}

export function listMailLogsForClient(clientId: string, take = 30) {
  return prisma.clientMailLog.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
