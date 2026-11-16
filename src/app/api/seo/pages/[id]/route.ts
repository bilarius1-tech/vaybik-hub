import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { seoPageSchema } from "@/server/seo/schemas";
import { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("settings.manage");
    const { id } = await ctx.params;
    const page = await prisma.seoPage.findUnique({ where: { id } });
    if (!page) return jsonError("NOT_FOUND", "Не найдено", 404);
    return jsonOk({ page });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("settings.manage");
    const { id } = await ctx.params;
    const body = seoPageSchema.partial().parse(await req.json());
    const page = await prisma.seoPage.update({
      where: { id },
      data: {
        ...body,
        canonical: body.canonical === "" ? null : body.canonical,
        ogImage: body.ogImage === "" ? null : body.ogImage,
        jsonLd:
          body.jsonLd === undefined
            ? undefined
            : body.jsonLd === null
              ? Prisma.DbNull
              : (body.jsonLd as Prisma.InputJsonValue),
      },
    });
    await writeAudit({
      actorId: auth.user.id,
      action: "seo.update",
      entity: "SeoPage",
      entityId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ page });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("settings.manage");
    const { id } = await ctx.params;
    await prisma.seoPage.delete({ where: { id } });
    await writeAudit({
      actorId: auth.user.id,
      action: "seo.delete",
      entity: "SeoPage",
      entityId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
