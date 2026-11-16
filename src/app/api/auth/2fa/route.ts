import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { twoFaSchema } from "@/server/auth/schemas";
import {
  attachSessionCookie,
  consumePendingLogin,
  createSession,
} from "@/server/auth/session";
import { decryptString } from "@/server/crypto/envelope";
import { hashBackupCode, normalizeBackupCode, verifyTotp } from "@/server/crypto/totp";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError } from "@/server/http/response";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = twoFaSchema.parse(await req.json());
    const ip = clientIp(req);
    const ua = userAgent(req);

    const pending = await consumePendingLogin(body.pendingToken);
    if (!pending) {
      return jsonError("PENDING_EXPIRED", "Сессия входа истекла, войдите снова", 401);
    }

    const user = await prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user || user.isBlocked || !user.totpEnabled || !user.totpSecretEnc) {
      return jsonError("INVALID", "Нельзя завершить вход", 401);
    }

    const secret = decryptString(user.totpSecretEnc);
    const code = body.code.trim();
    let ok = false;
    let usedBackup = false;

    if (/^\d{6}$/.test(code.replace(/\s/g, ""))) {
      ok = verifyTotp(secret, code);
    } else {
      const codeHash = hashBackupCode(normalizeBackupCode(code));
      const backup = await prisma.backupCode.findFirst({
        where: { userId: user.id, codeHash, usedAt: null },
      });
      if (backup) {
        await prisma.backupCode.update({
          where: { id: backup.id },
          data: { usedAt: new Date() },
        });
        ok = true;
        usedBackup = true;
      }
    }

    if (!ok) {
      await writeAudit({
        actorId: user.id,
        action: "auth.2fa_failed",
        entity: "User",
        entityId: user.id,
        ip,
        userAgent: ua,
      });
      return jsonError("INVALID_2FA", "Неверный код", 401);
    }

    const { token, expiresAt, remember } = await createSession({
      userId: user.id,
      ip,
      userAgent: ua,
      remember: pending.remember,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await writeAudit({
      actorId: user.id,
      action: usedBackup ? "auth.login_backup_code" : "auth.login_2fa",
      entity: "User",
      entityId: user.id,
      ip,
      userAgent: ua,
    });

    const res = NextResponse.json({ ok: true });
    attachSessionCookie(res, token, expiresAt, remember);
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
