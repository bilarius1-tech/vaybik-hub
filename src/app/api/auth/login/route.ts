import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import {
  attemptKeys,
  clearFailures,
  isBlocked,
  recordFailure,
} from "@/server/auth/rate-limit";
import { needsSetup2fa } from "@/server/auth/policy";
import { loginSchema } from "@/server/auth/schemas";
import {
  attachSessionCookie,
  createPendingLogin,
  createSession,
} from "@/server/auth/session";
import { verifyPassword } from "@/server/crypto/password";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError } from "@/server/http/response";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = loginSchema.parse(await req.json());
    const ip = clientIp(req);
    const ua = userAgent(req);
    const keys = attemptKeys(body.email, ip);

    if (await isBlocked(keys)) {
      await writeAudit({
        action: "auth.login_blocked",
        entity: "User",
        diff: { email: body.email },
        ip,
        userAgent: ua,
      });
      return jsonError("LOCKED", "Слишком много попыток. Подождите 15 минут.", 429);
    }

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const ok = user ? await verifyPassword(user.passwordHash, body.password) : false;

    if (!user || !ok || user.isBlocked) {
      const { blocked } = await recordFailure(keys);
      await writeAudit({
        actorId: user?.id,
        action: "auth.login_failed",
        entity: "User",
        entityId: user?.id,
        diff: { email: body.email, blocked },
        ip,
        userAgent: ua,
      });
      if (blocked) {
        return jsonError("LOCKED", "Слишком много попыток. Подождите 15 минут.", 429);
      }
      return jsonError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
    }

    await clearFailures(keys);

    const remember = body.remember;

    // REQUIRE_2FA=false — OWNER/ADMIN без TOTP входят по паролю
    if (needsSetup2fa(user)) {
      const { token, expiresAt } = await createSession({
        userId: user.id,
        ip,
        userAgent: ua,
        remember,
      });
      await writeAudit({
        actorId: user.id,
        action: "auth.login_needs_2fa_setup",
        entity: "User",
        entityId: user.id,
        ip,
        userAgent: ua,
      });
      const res = NextResponse.json({ ok: true, needsSetup2fa: true });
      attachSessionCookie(res, token, expiresAt, remember);
      return res;
    }

    if (!user.totpEnabled) {
      const { token, expiresAt } = await createSession({
        userId: user.id,
        ip,
        userAgent: ua,
        remember,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      await writeAudit({
        actorId: user.id,
        action: "auth.login",
        entity: "User",
        entityId: user.id,
        diff: { remember, twoFactor: false },
        ip,
        userAgent: ua,
      });
      const res = NextResponse.json({ ok: true, needs2fa: false });
      attachSessionCookie(res, token, expiresAt, remember);
      return res;
    }

    const pendingToken = await createPendingLogin(user.id, remember);
    await writeAudit({
      actorId: user.id,
      action: "auth.login_password_ok",
      entity: "User",
      entityId: user.id,
      ip,
      userAgent: ua,
    });

    return NextResponse.json({ ok: true, needs2fa: true, pendingToken });
  } catch (err) {
    return handleRouteError(err);
  }
}
