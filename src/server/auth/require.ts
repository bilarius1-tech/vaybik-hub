import type { Role } from "@prisma/client";
import {
  getSessionFromCookies,
  isReauthValid,
  type SessionContext,
} from "@/server/auth/session";
import {
  can,
  requirePermission,
  requireRole,
  type Action,
  type AuthUser,
} from "@/server/auth/rbac";

export class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function requireAuth(): Promise<SessionContext> {
  const ctx = await getSessionFromCookies();
  if (!ctx) {
    throw new AuthError("Требуется вход", 401, "UNAUTHORIZED");
  }
  return ctx;
}

export async function requireRoleAuth(
  roles: Role | Role[],
): Promise<SessionContext> {
  const ctx = await requireAuth();
  requireRole(ctx.user, roles);
  return ctx;
}

export async function requireCan(action: Action): Promise<SessionContext> {
  const ctx = await requireAuth();
  requirePermission(ctx.user, action);
  return ctx;
}

export async function requireReauth(): Promise<SessionContext> {
  const ctx = await requireAuth();
  if (!isReauthValid(ctx.reauthUntil)) {
    throw new AuthError(
      "Требуется повторная аутентификация",
      401,
      "REAUTH_REQUIRED",
    );
  }
  return ctx;
}

export { can };
export type { AuthUser, Action };
