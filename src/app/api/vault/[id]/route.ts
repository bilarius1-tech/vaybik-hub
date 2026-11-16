import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireRoleAuth } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { secretUpdateSchema } from "@/server/vault/schemas";
import { toMeta, updateSecretSecrets } from "@/server/vault/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("vault.read");
    const { id } = await ctx.params;
    const secret = await prisma.secret.findUnique({ where: { id } });
    if (!secret) return jsonError("NOT_FOUND", "Не найдено", 404);
    return jsonOk({ secret: toMeta(secret) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("vault.manage");
    const { id } = await ctx.params;
    const existing = await prisma.secret.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Не найдено", 404);

    const body = secretUpdateSchema.parse(await req.json());
    let secret;
    if (body.secrets) {
      secret = await updateSecretSecrets(id, body.secrets, {
        title: body.title,
        kind: body.kind,
        url: body.url === "" ? null : body.url,
        username: body.username,
        folder: body.folder,
        tags: body.tags,
        note: body.note,
      });
    } else {
      secret = await prisma.secret.update({
        where: { id },
        data: {
          title: body.title,
          kind: body.kind,
          url: body.url === "" ? null : body.url,
          username: body.username,
          folder: body.folder,
          tags: body.tags,
          note: body.note,
        },
      });
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "vault.update",
      entity: "Secret",
      entityId: id,
      diff: { title: secret.title, secretsChanged: !!body.secrets },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ secret: toMeta(secret) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireRoleAuth("OWNER");
    const { id } = await ctx.params;
    const existing = await prisma.secret.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Не найдено", 404);
    await prisma.secret.delete({ where: { id } });
    await writeAudit({
      actorId: auth.user.id,
      action: "vault.delete",
      entity: "Secret",
      entityId: id,
      diff: { title: existing.title },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
