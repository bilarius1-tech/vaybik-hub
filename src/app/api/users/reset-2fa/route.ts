import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireReauth } from "@/server/auth/require";
import { destroyAllUserSessions } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("users.reset2fa");
    await requireReauth();
    const body = z.object({ userId: z.string().min(1) }).parse(await req.json());

    const target = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!target) return jsonError("NOT_FOUND", "Не найден", 404);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: { totpEnabled: false, totpSecretEnc: null },
      }),
      prisma.backupCode.deleteMany({ where: { userId: target.id } }),
    ]);
    await destroyAllUserSessions(target.id);

    await writeAudit({
      actorId: ctx.user.id,
      action: "users.reset_2fa",
      entity: "User",
      entityId: target.id,
      diff: { email: target.email },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
