import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireAuth } from "@/server/auth/require";
import { changePasswordSchema } from "@/server/auth/schemas";
import { destroyAllUserSessions } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/crypto/password";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireAuth();
    const body = changePasswordSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user) return jsonError("NOT_FOUND", "Пользователь не найден", 404);

    const ok = await verifyPassword(user.passwordHash, body.currentPassword);
    if (!ok) return jsonError("INVALID", "Неверный текущий пароль", 401);

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await destroyAllUserSessions(user.id);

    await writeAudit({
      actorId: user.id,
      action: "profile.password_change",
      entity: "User",
      entityId: user.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ ok: true, reLogin: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
