import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import {
  clearSessionCookie,
  destroySessionByToken,
  readSessionToken,
  resolveSession,
} from "@/server/auth/session";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const token = readSessionToken(req);
    const ctx = await resolveSession(token);
    if (token) await destroySessionByToken(token);
    if (ctx) {
      await writeAudit({
        actorId: ctx.user.id,
        action: "auth.logout",
        entity: "User",
        entityId: ctx.user.id,
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
    }
    const res = jsonOk({ ok: true });
    clearSessionCookie(res as NextResponse);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
