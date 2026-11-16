import { getSessionFromCookies } from "@/server/auth/session";
import { jsonError, jsonOk } from "@/server/http/response";

export async function GET() {
  const ctx = await getSessionFromCookies();
  if (!ctx) return jsonError("UNAUTHORIZED", "Требуется вход", 401);
  return jsonOk({
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
      totpEnabled: ctx.user.totpEnabled,
    },
    reauthValid: !!(ctx.reauthUntil && ctx.reauthUntil > new Date()),
  });
}
