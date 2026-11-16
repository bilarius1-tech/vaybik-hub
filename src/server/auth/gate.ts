import { redirect } from "next/navigation";
import { needsSetup2fa } from "@/server/auth/policy";
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

/**
 * OWNER/ADMIN без 2FA → только setup-2fa (если REQUIRE_2FA не 'false').
 * При REQUIRE_2FA=false /setup-2fa остаётся доступной для добровольного включения.
 */
export async function enforce2faGate(user: AuthUser, pathname?: string) {
  const needs = needsSetup2fa(user);
  if (needs && pathname !== "/setup-2fa") {
    redirect("/setup-2fa");
  }
  if (user.totpEnabled && pathname === "/setup-2fa") {
    redirect("/");
  }
}
