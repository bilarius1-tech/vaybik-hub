import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { acceptInviteSchema } from "@/server/auth/schemas";
import {
  attachSessionCookie,
  createSession,
  hashSessionToken,
} from "@/server/auth/session";
import { hashPassword } from "@/server/crypto/password";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError } from "@/server/http/response";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = acceptInviteSchema.parse(await req.json());
    const tokenHash = hashSessionToken(body.token);
    const invite = await prisma.invite.findUnique({ where: { tokenHash } });
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
      return jsonError("INVALID_INVITE", "Приглашение недействительно", 400);
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          name: body.name,
          passwordHash,
          role: invite.role,
        },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      return created;
    });

    const ip = clientIp(req);
    const ua = userAgent(req);
    await writeAudit({
      actorId: user.id,
      action: "users.accept_invite",
      entity: "User",
      entityId: user.id,
      diff: { email: user.email, role: user.role },
      ip,
      userAgent: ua,
    });

    const { token, expiresAt } = await createSession({
      userId: user.id,
      ip,
      userAgent: ua,
    });
    const res = NextResponse.json({
      ok: true,
      needsSetup2fa: user.role === "OWNER" || user.role === "ADMIN",
    });
    attachSessionCookie(res, token, expiresAt);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
