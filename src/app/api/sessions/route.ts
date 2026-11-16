import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireAuth, requireCan, requireReauth } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { z } from "zod";

/** Список сессий: своих или чужих (owner) */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const userId = req.nextUrl.searchParams.get("userId") || ctx.user.id;
    if (userId !== ctx.user.id) {
      await requireCan("sessions.revoke");
    }
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        reauthUntil: true,
      },
    });
    return jsonOk({
      sessions: sessions.map((s) => ({
        ...s,
        current: s.id === ctx.sessionId,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Завершить сессию */
export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireAuth();
    const body = z
      .object({
        sessionId: z.string().min(1),
        userId: z.string().optional(),
      })
      .parse(await req.json());

    const session = await prisma.session.findUnique({
      where: { id: body.sessionId },
    });
    if (!session) return jsonError("NOT_FOUND", "Сессия не найдена", 404);

    if (session.userId !== ctx.user.id) {
      await requireCan("sessions.revoke");
      await requireReauth();
    }

    await prisma.session.delete({ where: { id: session.id } });
    await writeAudit({
      actorId: ctx.user.id,
      action: "sessions.revoke",
      entity: "Session",
      entityId: session.id,
      diff: { userId: session.userId },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
