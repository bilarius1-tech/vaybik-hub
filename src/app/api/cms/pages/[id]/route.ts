import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertPathAvailable, getPageWithBlocks } from "@/server/cms/service";
import { pageUpdateSchema } from "@/server/cms/schemas";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("content.manage");
    const { id } = await ctx.params;
    const page = await getPageWithBlocks(id);
    if (!page) return jsonError("NOT_FOUND", "Страница не найдена", 404);
    return jsonOk({ page });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const body = pageUpdateSchema.parse(await req.json());

    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Страница не найдена", 404);

    if (body.path && body.path !== existing.path) {
      await assertPathAvailable(body.path, id);
    }

    const page = await prisma.page.update({
      where: { id },
      data: {
        ...body,
        updatedById: auth.user.id,
        source: "manual",
      },
      include: { blocks: { orderBy: { sortOrder: "asc" } }, seoPage: true },
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.page.update",
      entity: "Page",
      entityId: id,
      diff: {
        path: page.path,
        title: page.title,
        status: page.status,
        template: page.template,
      },
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
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const existing = await prisma.page.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Страница не найдена", 404);

    await prisma.page.delete({ where: { id } });
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.page.delete",
      entity: "Page",
      entityId: id,
      diff: { path: existing.path },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
