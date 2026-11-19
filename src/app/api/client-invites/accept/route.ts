import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { acceptClientInviteSchema } from "@/server/auth/schemas";
import {
  attachSessionCookie,
  createSession,
} from "@/server/auth/session";
import { acceptClientInvite } from "@/server/clients/access";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError } from "@/server/http/response";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = acceptClientInviteSchema.parse(await req.json());
    const result = await acceptClientInvite({
      token: body.token,
      email: body.email,
      name: body.name,
      password: body.password,
    });
    if (!result.ok) {
      const status =
        result.code === "INVALID_INVITE"
          ? 400
          : result.code === "WEAK_PASSWORD"
            ? 400
            : 400;
      return jsonError(result.code, result.message, status);
    }

    const ip = clientIp(req);
    const ua = userAgent(req);
    await writeAudit({
      actorId: result.userId,
      action: "client.accept_invite",
      entity: "User",
      entityId: result.userId,
      ip,
      userAgent: ua,
    });

    const { token, expiresAt } = await createSession({
      userId: result.userId,
      ip,
      userAgent: ua,
      remember: false,
    });
    const res = NextResponse.json({
      ok: true,
      redirectTo: "/my-services",
    });
    attachSessionCookie(res, token, expiresAt);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
