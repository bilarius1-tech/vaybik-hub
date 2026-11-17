import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import {
  navItemPatchSchema,
  navItemSchema,
  navReorderSchema,
} from "@/server/cms/schemas";
import { prisma } from "@/server/db";
import { bumpSiteVersion } from "@/server/cms/site-version";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

export async function GET() {
  try {
    await requireCan("content.manage");
    const items = await prisma.navItem.findMany({
      orderBy: [{ menu: "asc" }, { sortOrder: "asc" }],
      include: { page: { select: { id: true, path: true, title: true } } },
    });
    return jsonOk({ items });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const body = navItemSchema.parse(await req.json());

    if (body.parentId) {
      const parent = await prisma.navItem.findUnique({
        where: { id: body.parentId },
      });
      if (!parent) return jsonError("NOT_FOUND", "Родитель не найден", 404);
      if (parent.parentId) {
        return jsonError(
          "VALIDATION",
          "Вложенность меню только 1 уровень",
        );
      }
      if (parent.menu !== body.menu) {
        return jsonError("VALIDATION", "Родитель должен быть того же меню");
      }
    }

    const item = await prisma.navItem.create({
      data: {
        menu: body.menu,
        parentId: body.parentId ?? null,
        label: body.label,
        url: body.url ?? null,
        pageId: body.pageId ?? null,
        sortOrder: body.sortOrder,
        isHidden: body.isHidden,
        isHighlighted: body.isHighlighted,
        openInNewTab: body.openInNewTab,
      },
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.nav.create",
      entity: "NavItem",
      entityId: item.id,
      diff: { menu: item.menu, label: item.label },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    await bumpSiteVersion(prisma, "cms.nav.create");
    return jsonOk({ item }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const raw = await req.json();

    if (raw && typeof raw === "object" && "items" in raw) {
      const { items } = navReorderSchema.parse(raw);
      await prisma.$transaction(
        items.map((it) =>
          prisma.navItem.update({
            where: { id: it.id },
            data: {
              sortOrder: it.sortOrder,
              ...(it.parentId !== undefined ? { parentId: it.parentId } : {}),
            },
          }),
        ),
      );
      await writeAudit({
        actorId: auth.user.id,
        action: "cms.nav.reorder",
        entity: "NavItem",
        diff: { count: items.length },
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      const updated = await prisma.navItem.findMany({
        orderBy: [{ menu: "asc" }, { sortOrder: "asc" }],
      });
      await bumpSiteVersion(prisma, "cms.nav.reorder");
      return jsonOk({ items: updated });
    }

    if (!raw || typeof raw !== "object" || !("id" in raw)) {
      return jsonError("VALIDATION", "нужен id");
    }
    const id = String((raw as { id: string }).id);
    const { id: _omit, ...rest } = raw as Record<string, unknown>;
    void _omit;
    const body = navItemPatchSchema.parse(rest);

    if (body.parentId) {
      const parent = await prisma.navItem.findUnique({
        where: { id: body.parentId },
      });
      if (!parent) return jsonError("NOT_FOUND", "Родитель не найден", 404);
      if (parent.parentId || parent.id === id) {
        return jsonError("VALIDATION", "Вложенность меню только 1 уровень");
      }
    }

    const item = await prisma.navItem.update({
      where: { id },
      data: body,
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.nav.update",
      entity: "NavItem",
      entityId: id,
      diff: { label: item.label, isHidden: item.isHidden },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    await bumpSiteVersion(prisma, "cms.nav.update");
    return jsonOk({ item });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const raw = await req.json();
    const id = raw && typeof raw === "object" ? String((raw as { id?: string }).id || "") : "";
    if (!id) return jsonError("VALIDATION", "нужен id");

    await prisma.navItem.delete({ where: { id } });
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.nav.delete",
      entity: "NavItem",
      entityId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    await bumpSiteVersion(prisma, "cms.nav.delete");
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
