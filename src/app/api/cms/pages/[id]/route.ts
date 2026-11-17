import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireRole } from "@/server/auth/require";
import { purgePage, softDeletePage } from "@/server/cms/pages-list";
import { assertPathAvailable, getPageWithBlocks } from "@/server/cms/service";
import { pageUpdateSchema } from "@/server/cms/schemas";
import { prisma } from "@/server/db";
import { bumpSiteVersion } from "@/server/cms/site-version";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("content.manage");
    const { id } = await ctx.params;
    const page = await getPageWithBlocks(id);
    if (!page || page.deletedAt) {
      return jsonError("NOT_FOUND", "Страница не найдена", 404);
    }
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

    const existing = await prisma.page.findFirst({
      where: { id, deletedAt: null },
    });
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

    if (
      body.path !== undefined ||
      body.template !== undefined ||
      body.status !== undefined
    ) {
      await bumpSiteVersion(prisma, "cms.page.update");
    }

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
    const purge = req.nextUrl.searchParams.get("purge") === "1";

    if (purge) {
      requireRole(auth.user, "OWNER");
      const page = await purgePage(id);
      await writeAudit({
        actorId: auth.user.id,
        action: "cms.page.purge",
        entity: "Page",
        entityId: id,
        diff: { path: page.path },
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      return jsonOk({ ok: true });
    }

    const page = await softDeletePage(id, auth.user.id);
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.page.trash",
      entity: "Page",
      entityId: id,
      diff: { path: page.path },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ page });
  } catch (err) {
    return handleRouteError(err);
  }
}
