import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { AuthError } from "@/server/auth/require";
import { reauthSchema } from "@/server/auth/schemas";
import {
  readSessionToken,
  resolveSession,
  setReauthUntil,
} from "@/server/auth/session";
import { decryptString } from "@/server/crypto/envelope";
import { verifyPassword } from "@/server/crypto/password";
import { verifyTotp } from "@/server/crypto/totp";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = reauthSchema.parse(await req.json());
    const token = readSessionToken(req);
    const ctx = await resolveSession(token);
    if (!ctx) throw new AuthError("Требуется вход", 401, "UNAUTHORIZED");

    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    if (!user?.totpSecretEnc || !user.totpEnabled) {
      return jsonError("NO_2FA", "Сначала настройте 2FA", 400);
    }

    const passOk = await verifyPassword(user.passwordHash, body.password);
    const secret = decryptString(user.totpSecretEnc);
    const totpOk = verifyTotp(secret, body.code);
    if (!passOk || !totpOk) {
      await writeAudit({
        actorId: user.id,
        action: "auth.reauth_failed",
        entity: "User",
        entityId: user.id,
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      return jsonError("INVALID", "Неверный пароль или код", 401);
    }

    const reauthUntil = await setReauthUntil(ctx.sessionId);
    await writeAudit({
      actorId: user.id,
      action: "auth.reauth",
      entity: "User",
      entityId: user.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true, reauthUntil: reauthUntil.toISOString() });
  } catch (err) {
    return handleRouteError(err);
  }
}
