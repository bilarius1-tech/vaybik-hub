import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_PATH,
  PENDING_LOGIN_TTL_MS,
  REAUTH_TTL_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "@/server/auth/constants";
import type { AuthUser } from "@/server/auth/rbac";
import { sha256Hex } from "@/server/crypto/password";
import { prisma } from "@/server/db";

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return sha256Hex(token);
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict" as const,
    path: COOKIE_PATH,
    expires: expiresAt,
  };
}

export async function createSession(params: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const token = newToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const sessionId = newToken(16);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: params.userId,
      tokenHash,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt,
    },
  });

  return { token, expiresAt, sessionId };
}

export async function destroySessionByToken(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export type SessionContext = {
  user: AuthUser;
  sessionId: string;
  reauthUntil: Date | null;
  token: string;
};

export async function resolveSession(
  token: string | undefined | null,
): Promise<SessionContext | null> {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          totpEnabled: true,
          isBlocked: true,
          partnerId: true,
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.isBlocked) return null;

  // Скользящее продление: если осталось < 6 ч — продлить до 12 ч
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < SESSION_TTL_MS / 2) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt },
    });
  }

  return {
    user: session.user,
    sessionId: session.id,
    reauthUntil: session.reauthUntil,
    token,
  };
}

export async function getSessionFromCookies(): Promise<SessionContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return resolveSession(token);
}

export function readSessionToken(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export function attachSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(new Date(0)),
    maxAge: 0,
  });
}

export async function createPendingLogin(userId: string): Promise<string> {
  const token = newToken();
  await prisma.pendingLogin.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + PENDING_LOGIN_TTL_MS),
    },
  });
  return token;
}

export async function consumePendingLogin(token: string) {
  const tokenHash = hashSessionToken(token);
  const pending = await prisma.pendingLogin.findUnique({ where: { tokenHash } });
  if (!pending || pending.expiresAt <= new Date()) {
    if (pending) {
      await prisma.pendingLogin.delete({ where: { id: pending.id } }).catch(() => undefined);
    }
    return null;
  }
  await prisma.pendingLogin.delete({ where: { id: pending.id } });
  return pending;
}

export async function setReauthUntil(sessionId: string): Promise<Date> {
  const reauthUntil = new Date(Date.now() + REAUTH_TTL_MS);
  await prisma.session.update({
    where: { id: sessionId },
    data: { reauthUntil },
  });
  return reauthUntil;
}

export function isReauthValid(reauthUntil: Date | null | undefined): boolean {
  return !!reauthUntil && reauthUntil > new Date();
}
