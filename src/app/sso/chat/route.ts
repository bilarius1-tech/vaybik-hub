import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { getSessionFromCookies } from "@/server/auth/session";
import { startStudioChatSso } from "@/server/chat/studio-sso";
import { clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError } from "@/server/http/response";

export const dynamic = "force-dynamic";

/**
 * GET /admin/sso/chat?next=/manage/...
 * Старт SSO студии в чат. Без сессии → логин с возвратом сюда.
 * OWNER/ADMIN → токен + редирект на chat /sso?token&next (без reauth).
 */
export async function GET(req: NextRequest) {
  try {
    const nextRaw = req.nextUrl.searchParams.get("next");
    const selfPath = `/sso/chat${nextRaw ? `?next=${encodeURIComponent(nextRaw)}` : ""}`;

    const ctx = await getSessionFromCookies();
    if (!ctx) {
      const login = req.nextUrl.clone();
      login.pathname = "/login";
      login.search = "";
      login.searchParams.set("next", selfPath);
      return NextResponse.redirect(login, 302);
    }

    if (ctx.user.role !== "OWNER" && ctx.user.role !== "ADMIN") {
      return jsonError("FORBIDDEN", "Недостаточно прав", 403);
    }

    const result = await startStudioChatSso({
      actor: { id: ctx.user.id, email: ctx.user.email },
      nextRaw,
    });

    if (!result.ok) {
      return jsonError(result.code, result.message, result.status);
    }

    await writeAudit({
      actorId: ctx.user.id,
      action: "chat.studio_sso",
      entity: "SsoJti",
      entityId: result.jti,
      diff: {
        jti: result.jti,
        mode: "impersonate",
        hubClientId: result.hubClientId,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    const res = NextResponse.redirect(result.ssoUrl, 302);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
