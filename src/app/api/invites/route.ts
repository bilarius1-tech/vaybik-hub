import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { INVITE_TTL_MS } from "@/server/auth/constants";
import { requireCan, requireReauth } from "@/server/auth/require";
import { inviteSchema } from "@/server/auth/schemas";
import { newToken, hashSessionToken } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

export async function GET() {
  try {
    await requireCan("users.invite");
    const invites = await prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return jsonOk({ invites });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("users.invite");
    await requireReauth();
    const body = inviteSchema.parse(await req.json());

    if (body.role === "OWNER" && ctx.user.role !== "OWNER") {
      return jsonError("FORBIDDEN", "Только owner может приглашать owner", 403);
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return jsonError("EXISTS", "Пользователь уже есть", 409);
    }

    const token = newToken();
    const invite = await prisma.invite.create({
      data: {
        email: body.email,
        role: body.role,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        createdBy: ctx.user.id,
      },
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: "users.invite",
      entity: "Invite",
      entityId: invite.id,
      diff: { email: body.email, role: body.role },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    const base = process.env.APP_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000/admin";
    return jsonOk({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      // токен показывается один раз
      acceptUrl: `${base}/invite/${token}`,
      token,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
