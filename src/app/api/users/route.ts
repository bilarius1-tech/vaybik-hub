import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireReauth } from "@/server/auth/require";
import { destroyAllUserSessions } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { z } from "zod";

export async function GET() {
  try {
    await requireCan("users.manage");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        totpEnabled: true,
        isBlocked: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { sessions: true } },
      },
    });
    return jsonOk({ users });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("users.block");
    await requireReauth();

    const body = z
      .object({
        userId: z.string().min(1),
        isBlocked: z.boolean(),
      })
      .parse(await req.json());

    if (body.userId === ctx.user.id) {
      return jsonError("BAD_REQUEST", "Нельзя блокировать себя", 400);
    }

    const updated = await prisma.user.update({
      where: { id: body.userId },
      data: { isBlocked: body.isBlocked },
      select: { id: true, email: true, isBlocked: true },
    });
    if (body.isBlocked) await destroyAllUserSessions(body.userId);

    await writeAudit({
      actorId: ctx.user.id,
      action: body.isBlocked ? "users.block" : "users.unblock",
      entity: "User",
      entityId: body.userId,
      diff: { email: updated.email },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ user: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
