import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { redirectInputSchema, validateRedirect } from "@/server/cms/redirects";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const body = redirectInputSchema.partial().parse(await req.json());

    const current = await prisma.redirect.findUnique({ where: { id } });
    if (!current) return jsonError("NOT_FOUND", "Редирект не найден", 404);

    const merged = {
      id,
      fromPath: body.fromPath ?? current.fromPath,
      toPath: body.toPath ?? current.toPath,
      match: body.match ?? current.match,
      isActive: body.isActive ?? current.isActive,
    };

    const existing = await prisma.redirect.findMany();
    const check = validateRedirect(merged, existing);
    if (!check.ok) {
      return jsonError("VALIDATION", check.errors[0] || "Ошибка валидации", 400, {
        errors: check.errors,
        warnings: check.warnings,
      });
    }

    const redirect = await prisma.redirect.update({
      where: { id },
      data: { ...body, updatedById: auth.user.id },
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.redirect.update",
      entity: "Redirect",
      entityId: id,
      diff: {
        fromPath: redirect.fromPath,
        toPath: redirect.toPath,
        isActive: redirect.isActive,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({
      redirect,
      warnings: check.warnings,
      suggestedToPath: check.suggestedToPath,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const current = await prisma.redirect.findUnique({ where: { id } });
    if (!current) return jsonError("NOT_FOUND", "Редирект не найден", 404);

    await prisma.redirect.delete({ where: { id } });
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.redirect.delete",
      entity: "Redirect",
      entityId: id,
      diff: { fromPath: current.fromPath },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
