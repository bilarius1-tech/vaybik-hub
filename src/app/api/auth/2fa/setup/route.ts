import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { writeAudit } from "@/server/auth/audit";
import { AuthError, requireAuth } from "@/server/auth/require";
import { setup2faConfirmSchema } from "@/server/auth/schemas";
import { encryptString } from "@/server/crypto/envelope";
import {
  buildTotpUri,
  createTotpSecret,
  generateBackupCodes,
  hashBackupCode,
  verifyTotp,
} from "@/server/crypto/totp";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

/** GET — выдать новый секрет + QR (ещё не сохранён) */
export async function GET() {
  try {
    const ctx = await requireAuth();
    if (ctx.user.totpEnabled) {
      return jsonError("ALREADY", "2FA уже включена", 400);
    }
    const secret = createTotpSecret();
    const uri = buildTotpUri(ctx.user.email, secret);
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return jsonOk({ secret, uri, qrDataUrl });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** POST — подтвердить код и сохранить */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireAuth();
    if (ctx.user.totpEnabled) {
      return jsonError("ALREADY", "2FA уже включена", 400);
    }
    const body = setup2faConfirmSchema.parse(await req.json());
    if (!verifyTotp(body.secret, body.code)) {
      return jsonError("INVALID_2FA", "Неверный код подтверждения", 400);
    }

    const codes = generateBackupCodes(10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: ctx.user.id },
        data: {
          totpSecretEnc: encryptString(body.secret),
          totpEnabled: true,
          lastLoginAt: new Date(),
        },
      });
      await tx.backupCode.deleteMany({ where: { userId: ctx.user.id } });
      await tx.backupCode.createMany({
        data: codes.map((code) => ({
          userId: ctx.user.id,
          codeHash: hashBackupCode(code),
        })),
      });
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: "auth.2fa_enabled",
      entity: "User",
      entityId: ctx.user.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ ok: true, backupCodes: codes });
  } catch (err) {
    if (err instanceof AuthError) return handleRouteError(err);
    return handleRouteError(err);
  }
}
