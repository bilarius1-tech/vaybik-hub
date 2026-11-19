import { CLIENT_INVITE_TTL_MS } from "@/server/auth/constants";
import { hashSessionToken, newToken } from "@/server/auth/session";
import {
  CLIENT_PASSWORD_MIN,
  hashPassword,
} from "@/server/crypto/password";
import { prisma } from "@/server/db";
import {
  buildSafeReturnUrl,
  issueSsoToken,
} from "@/server/chat/sso-token";
import { getChatSsoConfig } from "@/server/chat/config";
import { resolveManageUrl } from "@/server/clients/status-map";
import { cabinetLoginUrl, isMailConfigured } from "@/server/mail/config";
import { listMailLogsForClient } from "@/server/mail/client-notify";
import { getInviteMessageTemplate } from "@/server/clients/invite-message";

function inviteBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000/admin"
  );
}

export async function getClientAccess(clientId: string) {
  const [client, members, invites, mailLogs, inviteMessageTemplate] =
    await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: { emailNotifyEnabled: true },
      }),
      prisma.clientMember.findMany({
        where: { clientId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              isBlocked: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.clientInvite.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      listMailLogsForClient(clientId, 25),
      getInviteMessageTemplate(),
    ]);

  const now = new Date();
  const activeInvite = invites.find(
    (i) => !i.usedAt && !i.revokedAt && i.expiresAt > now,
  );

  return {
    emailNotifyEnabled: client?.emailNotifyEnabled ?? false,
    mailConfigured: isMailConfigured(),
    inviteMessageTemplate,
    loginUrl: cabinetLoginUrl(),
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      isBlocked: m.user.isBlocked,
      lastLoginAt: m.user.lastLoginAt,
      createdAt: m.createdAt,
    })),
    activeInvite: activeInvite
      ? {
          id: activeInvite.id,
          email: activeInvite.email,
          expiresAt: activeInvite.expiresAt,
          createdAt: activeInvite.createdAt,
        }
      : null,
    mailLogs: mailLogs.map((l) => ({
      id: l.id,
      kind: l.kind,
      toEmail: l.toEmail,
      subject: l.subject,
      status: l.status,
      error: l.error,
      periodKey: l.periodKey,
      createdAt: l.createdAt,
    })),
  };
}

export type CreateClientInviteResult =
  | {
      ok: true;
      inviteId: string;
      email: string | null;
      expiresAt: Date;
      acceptUrl: string;
      token: string;
    }
  | { ok: false; code: string; message: string };

/** Создать приглашение (72 ч). Предыдущие активные — отозвать. */
export async function createClientInvite(input: {
  clientId: string;
  email?: string | null;
  createdBy: string;
}): Promise<CreateClientInviteResult> {
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
  });
  if (!client) {
    return { ok: false, code: "NOT_FOUND", message: "Клиент не найден" };
  }

  const emailRaw = input.email?.trim().toLowerCase() || null;
  if (emailRaw) {
    const existing = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (existing && existing.role !== "CLIENT") {
      return {
        ok: false,
        code: "EMAIL_TAKEN",
        message: "Этот email уже занят сотрудником студии",
      };
    }
    if (existing) {
      const other = await prisma.clientMember.findUnique({
        where: { userId: existing.id },
      });
      if (other && other.clientId !== input.clientId) {
        return {
          ok: false,
          code: "OTHER_CLIENT",
          message: "Этот email уже привязан к другому клиенту",
        };
      }
    }
  }

  const token = newToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + CLIENT_INVITE_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.clientInvite.updateMany({
      where: {
        clientId: input.clientId,
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await tx.clientInvite.create({
      data: {
        clientId: input.clientId,
        email: emailRaw,
        tokenHash,
        expiresAt,
        createdBy: input.createdBy,
      },
    });
  });

  const invite = await prisma.clientInvite.findUniqueOrThrow({
    where: { tokenHash },
  });

  return {
    ok: true,
    inviteId: invite.id,
    email: invite.email,
    expiresAt: invite.expiresAt,
    acceptUrl: `${inviteBaseUrl()}/invite/${token}`,
    token,
  };
}

export async function revokeClientInvite(
  clientId: string,
  inviteId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const invite = await prisma.clientInvite.findFirst({
    where: { id: inviteId, clientId },
  });
  if (!invite) {
    return { ok: false, code: "NOT_FOUND", message: "Приглашение не найдено" };
  }
  if (invite.usedAt) {
    return { ok: false, code: "USED", message: "Приглашение уже использовано" };
  }
  if (invite.revokedAt) {
    return { ok: true };
  }
  await prisma.clientInvite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}

export async function lookupClientInvite(token: string) {
  const tokenHash = hashSessionToken(token);
  const invite = await prisma.clientInvite.findUnique({
    where: { tokenHash },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!invite) return null;
  const now = new Date();
  const valid =
    !invite.usedAt && !invite.revokedAt && invite.expiresAt > now;
  return {
    kind: "client" as const,
    valid,
    email: invite.email,
    clientName: invite.client.name,
    expiresAt: invite.expiresAt,
    used: Boolean(invite.usedAt),
    revoked: Boolean(invite.revokedAt),
  };
}

export type AcceptClientInviteResult =
  | { ok: true; userId: string }
  | { ok: false; code: string; message: string };

export async function acceptClientInvite(input: {
  token: string;
  email?: string | null;
  name?: string | null;
  password: string;
}): Promise<AcceptClientInviteResult> {
  if (input.password.length < CLIENT_PASSWORD_MIN) {
    return {
      ok: false,
      code: "WEAK_PASSWORD",
      message: `Пароль ≥ ${CLIENT_PASSWORD_MIN} символов`,
    };
  }

  const tokenHash = hashSessionToken(input.token);
  const invite = await prisma.clientInvite.findUnique({
    where: { tokenHash },
  });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= new Date()) {
    return {
      ok: false,
      code: "INVALID_INVITE",
      message: "Приглашение недействительно или истекло",
    };
  }

  const email = (invite.email || input.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      code: "EMAIL_REQUIRED",
      message: "Укажите корректный email",
    };
  }
  if (invite.email && invite.email !== email) {
    return {
      ok: false,
      code: "EMAIL_MISMATCH",
      message: "Email не совпадает с приглашением",
    };
  }

  const passwordHash = await hashPassword(input.password, CLIENT_PASSWORD_MIN);
  const name = input.name?.trim() || email.split("@")[0] || "Клиент";

  try {
    const userId = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      let userId: string;

      if (existing) {
        if (existing.role !== "CLIENT") {
          throw Object.assign(new Error("EMAIL_TAKEN"), { code: "EMAIL_TAKEN" });
        }
        const member = await tx.clientMember.findUnique({
          where: { userId: existing.id },
        });
        if (member && member.clientId !== invite.clientId) {
          throw Object.assign(new Error("OTHER_CLIENT"), {
            code: "OTHER_CLIENT",
          });
        }
        await tx.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            name: input.name?.trim() ? name : existing.name,
            isBlocked: false,
          },
        });
        userId = existing.id;
        if (!member) {
          await tx.clientMember.create({
            data: { clientId: invite.clientId, userId },
          });
        }
      } else {
        const created = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: "CLIENT",
          },
        });
        userId = created.id;
        await tx.clientMember.create({
          data: { clientId: invite.clientId, userId },
        });
      }

      await tx.clientInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date(), email },
      });
      return userId;
    });

    return { ok: true, userId };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    if (code === "EMAIL_TAKEN") {
      return {
        ok: false,
        code: "EMAIL_TAKEN",
        message: "Этот email уже занят",
      };
    }
    if (code === "OTHER_CLIENT") {
      return {
        ok: false,
        code: "OTHER_CLIENT",
        message: "Этот email уже привязан к другому клиенту",
      };
    }
    throw err;
  }
}

export async function listMyServices(userId: string) {
  const member = await prisma.clientMember.findUnique({
    where: { userId },
    include: {
      client: {
        include: {
          services: { include: { service: true } },
        },
      },
    },
  });
  if (!member) return null;

  const services = member.client.services
    .filter((cs) => cs.service.isProduct)
    .map((cs) => ({
      id: cs.id,
      status: cs.status,
      activeFrom: cs.activeFrom,
      activeUntil: cs.activeUntil,
      paymentNote: cs.paymentNote,
      externalId: cs.externalId,
      slug: cs.service.slug,
      name: cs.service.name,
      manageHref: resolveManageUrl(cs.service.manageUrl, cs.externalId),
      canOpen:
        cs.service.slug === "chat" &&
        Boolean(cs.externalId) &&
        Boolean(getChatSsoConfig()),
    }));

  return {
    client: {
      id: member.client.id,
      name: member.client.name,
      siteUrl: member.client.siteUrl,
      status: member.client.status,
    },
    services,
  };
}

/** SSO mode=client для своего клиента. */
export async function startClientSelfSso(input: {
  userId: string;
  email: string;
  clientServiceId: string;
}): Promise<
  | { ok: true; ssoUrl: string; jti: string }
  | { ok: false; code: string; message: string }
> {
  if (!getChatSsoConfig()) {
    return {
      ok: false,
      code: "CHAT_SSO_NOT_CONFIGURED",
      message: "Чат SSO не настроен",
    };
  }

  const member = await prisma.clientMember.findUnique({
    where: { userId: input.userId },
  });
  if (!member) {
    return { ok: false, code: "NO_MEMBER", message: "Нет привязки к клиенту" };
  }

  const link = await prisma.clientService.findUnique({
    where: { id: input.clientServiceId },
    include: { service: true },
  });
  if (!link || link.clientId !== member.clientId) {
    return { ok: false, code: "FORBIDDEN", message: "Сервис недоступен" };
  }
  if (link.service.slug !== "chat") {
    return {
      ok: false,
      code: "UNSUPPORTED",
      message: "Открытие пока только для Чата",
    };
  }
  if (!link.externalId) {
    return {
      ok: false,
      code: "NO_EXTERNAL_ID",
      message: "Чат ещё не подключён",
    };
  }

  const returnUrl = buildSafeReturnUrl("/my-services");
  if (!returnUrl) {
    return {
      ok: false,
      code: "NO_APP_URL",
      message: "Задайте APP_URL в .env",
    };
  }

  const { ssoUrl, jti, exp } = issueSsoToken({
    mode: "client",
    userId: input.userId,
    email: input.email,
    hubClientId: member.clientId,
    impersonatedBy: null,
    returnUrl,
  });

  await prisma.ssoJti.create({
    data: {
      jti,
      mode: "client",
      userId: input.userId,
      clientId: member.clientId,
      expiresAt: new Date(exp * 1000),
    },
  });

  return { ok: true, ssoUrl, jti };
}
