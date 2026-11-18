import type { Role, User } from "@prisma/client";

export type Action =
  | "users.manage"
  | "users.invite"
  | "users.block"
  | "users.reset2fa"
  | "sessions.revoke"
  | "activity.read"
  | "services.manage"
  | "vault.read"
  | "vault.manage"
  | "settings.manage"
  | "databases.read"
  | "databases.restore"
  | "content.manage"
  | "clients.manage"
  | "partner.self";

const ROLE_PERMS: Record<Role, ReadonlySet<Action>> = {
  OWNER: new Set([
    "users.manage",
    "users.invite",
    "users.block",
    "users.reset2fa",
    "sessions.revoke",
    "activity.read",
    "services.manage",
    "vault.read",
    "vault.manage",
    "settings.manage",
    "databases.read",
    "databases.restore",
    "content.manage",
    "clients.manage",
  ]),
  ADMIN: new Set([
    "activity.read",
    "services.manage",
    "vault.read",
    "vault.manage",
    "settings.manage",
    "databases.read",
    "content.manage",
    "clients.manage",
  ]),
  PARTNER: new Set(["partner.self"]),
};

export type AuthUser = Pick<User, "id" | "email" | "role" | "totpEnabled" | "isBlocked" | "partnerId" | "name">;

export function can(user: AuthUser, action: Action): boolean {
  if (user.isBlocked) return false;
  return ROLE_PERMS[user.role].has(action);
}

export function requireRole(
  user: AuthUser,
  roles: Role | Role[],
): void {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (user.isBlocked || !allowed.includes(user.role)) {
    const err = new Error("Недостаточно прав") as Error & { status: number; code: string };
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }
}

export function requirePermission(user: AuthUser, action: Action): void {
  if (!can(user, action)) {
    const err = new Error("Недостаточно прав") as Error & { status: number; code: string };
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }
}
