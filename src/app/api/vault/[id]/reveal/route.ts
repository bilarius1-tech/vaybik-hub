import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireReauth } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { revealSecretPayload, toMeta } from "@/server/vault/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("vault.read");
    await requireReauth();
    const { id } = await ctx.params;
    const secret = await prisma.secret.findUnique({ where: { id } });
    if (!secret) return jsonError("NOT_FOUND", "Не найдено", 404);

    const secrets = revealSecretPayload(secret);

    await writeAudit({
      actorId: auth.user.id,
      action: "vault.reveal",
      entity: "Secret",
      entityId: id,
      diff: { title: secret.title, kind: secret.kind },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({
      secret: toMeta(secret),
      secrets,
      autoClearMs: 30_000,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
