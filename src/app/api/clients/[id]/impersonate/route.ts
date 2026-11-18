import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireReauth } from "@/server/auth/require";
import { startClientImpersonate } from "@/server/clients/impersonate";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

/**
 * «Войти как клиент»: reauth → выпуск SSO → 200 { redirectUrl }.
 * Не 302: fetch+redirect:manual даёт opaqueredirect без Location.
 * Токен только внутри redirectUrl; в AuditLog.diff — только jti.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    await requireCan("clients.manage");
    const auth = await requireReauth();
    const { id } = await ctx.params;

    const result = await startClientImpersonate({
      clientId: id,
      actor: { id: auth.user.id, email: auth.user.email },
    });

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "CHAT_SSO_NOT_CONFIGURED"
            ? 503
            : 400;
      return jsonError(result.code, result.message, status);
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "client.impersonate",
      entity: "Client",
      entityId: id,
      diff: {
        jti: result.jti,
        mode: "impersonate",
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk(
      { redirectUrl: result.ssoUrl },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
