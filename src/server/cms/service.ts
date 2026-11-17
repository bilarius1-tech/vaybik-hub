import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  syncBlockMediaUsage,
  syncRevisionMediaUsage,
} from "@/server/cms/media/sync-usage";
import { parseBlockData } from "./blocks";
import { bumpSiteVersion } from "./site-version";

const REVISION_LIMIT = 20;

export async function getPageWithBlocks(id: string) {
  return prisma.page.findFirst({
    where: { id, deletedAt: null },
    include: {
      blocks: { orderBy: { sortOrder: "asc" } },
      seoPage: true,
      revisions: {
        orderBy: { createdAt: "desc" },
        take: REVISION_LIMIT,
        select: {
          id: true,
          note: true,
          createdAt: true,
          createdById: true,
        },
      },
    },
  });
}

export async function assertPathAvailable(
  path: string,
  excludePageId?: string,
): Promise<void> {
  const existing = await prisma.page.findFirst({
    where: {
      path,
      deletedAt: null,
      ...(excludePageId ? { id: { not: excludePageId } } : {}),
    },
  });
  if (existing) {
    throw Object.assign(new Error(`Путь «${path}» уже занят`), {
      status: 409,
      code: "CONFLICT",
    });
  }
  const redirect = await prisma.redirect.findFirst({
    where: { fromPath: path, isActive: true },
  });
  if (redirect) {
    throw Object.assign(
      new Error(`Путь «${path}» совпадает с активным редиректом`),
      { status: 409, code: "CONFLICT" },
    );
  }
}

export async function buildPageSnapshot(pageId: string) {
  const page = await prisma.page.findUniqueOrThrow({
    where: { id: pageId },
    include: {
      blocks: { orderBy: { sortOrder: "asc" } },
      seoPage: true,
    },
  });
  return {
    page: {
      id: page.id,
      path: page.path,
      title: page.title,
      template: page.template,
      status: page.status,
      sortOrder: page.sortOrder,
    },
    blocks: page.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      sortOrder: b.sortOrder,
      data: b.data,
      isHidden: b.isHidden,
      anchor: b.anchor,
    })),
    seo: page.seoPage,
  };
}

export async function publishPage(
  pageId: string,
  userId: string | null,
  note?: string | null,
) {
  const snapshot = await buildPageSnapshot(pageId);
  return prisma.$transaction(async (tx) => {
    const rev = await tx.pageRevision.create({
      data: {
        pageId,
        snapshot: snapshot as Prisma.InputJsonValue,
        note: note || "публикация",
        createdById: userId,
      },
    });
    const page = await tx.page.update({
      where: { id: pageId },
      data: {
        status: "PUBLISHED",
        publishedRevisionId: rev.id,
        publishedAt: new Date(),
        ...(userId ? { updatedById: userId } : {}),
        source: userId ? "manual" : "import",
      },
    });
    const snapBlocks = (
      snapshot as {
        blocks?: { id?: string; type: string; data: unknown }[];
      }
    ).blocks;
    if (snapBlocks?.length) {
      await syncRevisionMediaUsage(tx, {
        pageId,
        revisionId: rev.id,
        blocks: snapBlocks,
      });
    }
    const old = await tx.pageRevision.findMany({
      where: { pageId },
      orderBy: { createdAt: "desc" },
      skip: REVISION_LIMIT,
      select: { id: true },
    });
    if (old.length) {
      await tx.pageRevision.deleteMany({
        where: { id: { in: old.map((o) => o.id) } },
      });
    }
    await bumpSiteVersion(tx, "cms.page.publish");
    return { page, revision: rev };
  });
}

export async function restoreRevision(
  revisionId: string,
  userId: string,
) {
  const rev = await prisma.pageRevision.findUnique({
    where: { id: revisionId },
  });
  if (!rev) {
    throw Object.assign(new Error("Ревизия не найдена"), {
      status: 404,
      code: "NOT_FOUND",
    });
  }

  const snap = rev.snapshot as {
    page?: { title?: string; template?: string };
    blocks?: Array<{
      type: string;
      sortOrder: number;
      data: unknown;
      isHidden?: boolean;
      anchor?: string | null;
    }>;
  };

  return prisma.$transaction(async (tx) => {
    const currentSnap = await buildPageSnapshot(rev.pageId);
    await tx.pageRevision.create({
      data: {
        pageId: rev.pageId,
        snapshot: currentSnap as Prisma.InputJsonValue,
        note: "до восстановления",
        createdById: userId,
      },
    });

    await tx.block.deleteMany({ where: { pageId: rev.pageId } });

    const blocks = snap.blocks || [];
    for (const b of blocks) {
      const data = parseBlockData(b.type, b.data ?? {});
      const created = await tx.block.create({
        data: {
          pageId: rev.pageId,
          type: b.type,
          sortOrder: b.sortOrder,
          data: data as Prisma.InputJsonValue,
          isHidden: b.isHidden ?? false,
          anchor: b.anchor ?? null,
        },
      });
      await syncBlockMediaUsage(tx, {
        pageId: rev.pageId,
        blockId: created.id,
        type: created.type,
        data: created.data,
      });
    }

    const page = await tx.page.update({
      where: { id: rev.pageId },
      data: {
        title: snap.page?.title,
        template: snap.page?.template,
        status: "DRAFT",
        updatedById: userId,
        source: "manual",
      },
      include: { blocks: { orderBy: { sortOrder: "asc" } } },
    });

    const old = await tx.pageRevision.findMany({
      where: { pageId: rev.pageId },
      orderBy: { createdAt: "desc" },
      skip: REVISION_LIMIT,
      select: { id: true },
    });
    if (old.length) {
      await tx.pageRevision.deleteMany({
        where: { id: { in: old.map((o) => o.id) } },
      });
    }

    return page;
  });
}
