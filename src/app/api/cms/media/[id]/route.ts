import { NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireRole } from "@/server/auth/require";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { prisma } from "@/server/db";
import { bumpSiteVersion } from "@/server/cms/site-version";
import {
  MediaError,
  removeMediaAssetDir,
  toMediaDto,
} from "@/server/cms/media/store";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  alt: z.string().max(500).nullable().optional(),
  title: z.string().max(500).nullable().optional(),
  caption: z.string().max(2000).nullable().optional(),
  folderId: z.string().nullable().optional(),
  tags: z.array(z.string().max(64)).max(30).optional(),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("content.manage");
    const { id } = await ctx.params;
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        usages: {
          include: {
            page: { select: { id: true, path: true, title: true } },
            block: { select: { id: true, type: true, anchor: true } },
          },
          take: 100,
        },
      },
    });
    if (!asset) return jsonError("NOT_FOUND", "Медиа не найдено", 404);
    return jsonOk({
      asset: toMediaDto(asset),
      usages: asset.usages.map((u) => ({
        id: u.id,
        field: u.field,
        page: u.page,
        block: u.block,
        revisionId: u.revisionId,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const current = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!current || current.deletedAt) {
      return jsonError("NOT_FOUND", "Медиа не найдено", 404);
    }
    if (body.folderId) {
      const folder = await prisma.mediaFolder.findUnique({
        where: { id: body.folderId },
      });
      if (!folder) return jsonError("NOT_FOUND", "Папка не найдена", 404);
    }
    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: {
        ...(body.alt !== undefined ? { alt: body.alt } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
        ...(body.folderId !== undefined ? { folderId: body.folderId } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
      },
    });
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.media.update",
      entity: "MediaAsset",
      entityId: id,
      diff: body,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    if (body.alt !== undefined) {
      await bumpSiteVersion(prisma, "cms.media.update");
    }
    return jsonOk({ asset: toMediaDto(updated) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const purge = sp.get("purge") === "1";

    const current = await prisma.mediaAsset.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });
    if (!current) return jsonError("NOT_FOUND", "Медиа не найдено", 404);

    if (purge) {
      requireRole(auth.user, "OWNER");
      if (!current.deletedAt) {
        return jsonError(
          "VALIDATION",
          "Сначала переместите в корзину",
          400,
        );
      }
      await prisma.mediaAsset.delete({ where: { id } });
      await removeMediaAssetDir(id).catch(() => undefined);
      await writeAudit({
        actorId: auth.user.id,
        action: "cms.media.purge",
        entity: "MediaAsset",
        entityId: id,
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      return jsonOk({ ok: true });
    }

    if (current._count.usages > 0) {
      const usages = await prisma.mediaUsage.findMany({
        where: { mediaId: id },
        include: {
          page: { select: { id: true, path: true, title: true } },
          block: { select: { id: true, type: true } },
        },
        take: 50,
      });
      return jsonError(
        "IN_USE",
        "Медиа используется — удаление запрещено",
        409,
        {
          usages: usages.map((u) => ({
            field: u.field,
            page: u.page,
            block: u.block,
          })),
        },
      );
    }

    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.media.delete",
      entity: "MediaAsset",
      entityId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ asset: toMediaDto(updated) });
  } catch (err) {
    if (err instanceof MediaError) {
      return jsonError(err.code, err.message, err.status, err.extra);
    }
    return handleRouteError(err);
  }
}
