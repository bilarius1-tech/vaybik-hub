import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/server/auth/session";
import type { AuthUser } from "@/server/auth/rbac";

export async function requirePageSession(): Promise<{
  user: AuthUser;
  sessionId: string;
}> {
  const ctx = await getSessionFromCookies();
  if (!ctx) redirect("/login");
  return { user: ctx.user, sessionId: ctx.sessionId };
}

/** OWNER/ADMIN без 2FA → только setup-2fa */
export async function enforce2faGate(user: AuthUser, pathname?: string) {
  const needs =
    (user.role === "OWNER" || user.role === "ADMIN") && !user.totpEnabled;
  if (needs && pathname !== "/setup-2fa") {
    redirect("/setup-2fa");
  }
  if (!needs && pathname === "/setup-2fa") {
    redirect("/");
  }
}
