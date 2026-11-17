import type { PageStatus, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { normalizePagePath } from "./path";
import { parseBlockData } from "./blocks";
import { publishPage } from "./service";

export const PAGE_SORT_KEYS = [
  "path",
  "title",
  "template",
  "status",
  "blocks",
  "updatedAt",
] as const;

export type PageSortKey = (typeof PAGE_SORT_KEYS)[number];

export type PageListParams = {
  q?: string;
  status?: PageStatus | "ALL";
  template?: string | "ALL";
  sort?: string;
  page?: number;
  pageSize?: number;
  trash?: boolean;
};

export type PageRefBlocker = {
  kind: "home" | "nav" | "redirect";
  label: string;
  detail?: string;
};

const PAGE_INCLUDE = {
  _count: { select: { blocks: true } },
  updatedBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.PageInclude;

export type PageListItem = Prisma.PageGetPayload<{ include: typeof PAGE_INCLUDE }>;

export function parsePageSort(sort?: string | null): {
  key: PageSortKey;
  dir: "asc" | "desc";
} {
  const raw = (sort || "-updatedAt").trim();
  const desc = raw.startsWith("-");
  const key = (desc ? raw.slice(1) : raw) as PageSortKey;
  if (!PAGE_SORT_KEYS.includes(key)) {
    return { key: "updatedAt", dir: "desc" };
  }
  return { key, dir: desc ? "desc" : "asc" };
}

export function parsePageSize(raw?: string | number | null): number {
  const n = typeof raw === "number" ? raw : Number(raw || "25");
  if (n === 50 || n === 100) return n;
  return 25;
}

export async function listPages(params: PageListParams) {
  const trash = !!params.trash;
  const page = Math.max(1, params.page || 1);
  const pageSize = parsePageSize(params.pageSize);
  const { key, dir } = parsePageSort(params.sort);
  const q = params.q?.trim();

  const where: Prisma.PageWhereInput = {
    deletedAt: trash ? { not: null } : null,
  };

  if (params.status && params.status !== "ALL") {
    where.status = params.status;
  }
  if (params.template && params.template !== "ALL") {
    where.template = params.template;
  }
  if (q) {
    where.OR = [
      { path: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
    ];
  }

  let orderBy: Prisma.PageOrderByWithRelationInput | Prisma.PageOrderByWithRelationInput[];
  if (key === "blocks") {
    orderBy = { blocks: { _count: dir } };
  } else {
    orderBy = { [key]: dir };
  }

  const [total, pages] = await Promise.all([
    prisma.page.count({ where }),
    prisma.page.findMany({
      where,
      include: PAGE_INCLUDE,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    pages,
    total,
    page,
    pageSize,
    sort: `${dir === "desc" ? "-" : ""}${key}`,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function findPageDeleteBlockers(
  pageId: string,
): Promise<PageRefBlocker[]> {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) return [];

  const blockers: PageRefBlocker[] = [];
  if (page.path === "/") {
    blockers.push({
      kind: "home",
      label: "Главная страница «/»",
      detail: "Удаление главной запрещено",
    });
  }

  const navItems = await prisma.navItem.findMany({
    where: {
      OR: [
        { pageId },
        { url: page.path },
        { url: page.path.replace(/\/$/, "") || "/" },
      ],
    },
    select: { id: true, label: true, menu: true, url: true },
  });
  for (const n of navItems) {
    blockers.push({
      kind: "nav",
      label: `Меню ${n.menu}: «${n.label}»`,
      detail: n.url || page.path,
    });
  }

  const redirects = await prisma.redirect.findMany({
    where: {
      OR: [{ toPath: page.path }, { fromPath: page.path }],
    },
    select: { id: true, fromPath: true, toPath: true, code: true },
  });
  for (const r of redirects) {
    blockers.push({
      kind: "redirect",
      label: `Редирект ${r.fromPath} → ${r.toPath}`,
      detail: String(r.code),
    });
  }

  return blockers;
}

export async function softDeletePage(pageId: string, userId: string) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: null },
  });
  if (!page) {
    throw Object.assign(new Error("Страница не найдена"), {
      status: 404,
      code: "NOT_FOUND",
    });
  }

  const blockers = await findPageDeleteBlockers(pageId);
  if (blockers.length) {
    throw Object.assign(
      new Error(
        blockers[0]!.kind === "home"
          ? "Нельзя удалить главную страницу «/»"
          : "Страница связана с меню или редиректом",
      ),
      {
        status: 409,
        code: "IN_USE",
        extra: { blockers, path: page.path },
      },
    );
  }

  return prisma.page.update({
    where: { id: pageId },
    data: {
      deletedAt: new Date(),
      status: "ARCHIVED",
      updatedById: userId,
    },
    include: PAGE_INCLUDE,
  });
}

export async function restorePage(pageId: string, userId: string) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: { not: null } },
  });
  if (!page) {
    throw Object.assign(new Error("Страница не в корзине"), {
      status: 404,
      code: "NOT_FOUND",
    });
  }

  const conflict = await prisma.page.findFirst({
    where: { path: page.path, deletedAt: null, id: { not: pageId } },
  });
  if (conflict) {
    throw Object.assign(
      new Error(`Путь «${page.path}» уже занят активной страницей`),
      { status: 409, code: "CONFLICT" },
    );
  }

  return prisma.page.update({
    where: { id: pageId },
    data: {
      deletedAt: null,
      status: "DRAFT",
      updatedById: userId,
      source: "manual",
    },
    include: PAGE_INCLUDE,
  });
}

export async function purgePage(pageId: string) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: { not: null } },
  });
  if (!page) {
    throw Object.assign(new Error("Сначала переместите в корзину"), {
      status: 400,
      code: "VALIDATION",
    });
  }
  await prisma.page.delete({ where: { id: pageId } });
  return page;
}

export async function unpublishPage(pageId: string, userId: string) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: null },
  });
  if (!page) {
    throw Object.assign(new Error("Страница не найдена"), {
      status: 404,
      code: "NOT_FOUND",
    });
  }
  return prisma.page.update({
    where: { id: pageId },
    data: {
      status: "DRAFT",
      updatedById: userId,
      source: "manual",
    },
    include: PAGE_INCLUDE,
  });
}

function nextCopyPath(base: string): string {
  if (base === "/") return "/copy/";
  const trimmed = base.replace(/\/$/, "");
  return `${trimmed}-copy/`;
}

export async function duplicatePage(pageId: string, userId: string) {
  const source = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: null },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) {
    throw Object.assign(new Error("Страница не найдена"), {
      status: 404,
      code: "NOT_FOUND",
    });
  }

  let candidate = nextCopyPath(source.path);
  for (let i = 2; i < 50; i++) {
    const taken = await prisma.page.findFirst({
      where: { path: candidate, deletedAt: null },
      select: { id: true },
    });
    if (!taken) break;
    if (source.path === "/") {
      candidate = `/copy-${i}/`;
    } else {
      const trimmed = source.path.replace(/\/$/, "");
      candidate = `${trimmed}-copy-${i}/`;
    }
  }
  candidate = normalizePagePath(candidate);

  return prisma.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: {
        path: candidate,
        title: `${source.title} (копия)`,
        template: source.template,
        status: "DRAFT",
        sortOrder: source.sortOrder,
        source: "manual",
        updatedById: userId,
      },
    });

    for (const b of source.blocks) {
      const data = parseBlockData(b.type, b.data ?? {});
      await tx.block.create({
        data: {
          pageId: page.id,
          type: b.type,
          sortOrder: b.sortOrder,
          data: data as Prisma.InputJsonValue,
          isHidden: b.isHidden,
          anchor: b.anchor,
        },
      });
    }

    return tx.page.findUniqueOrThrow({
      where: { id: page.id },
      include: PAGE_INCLUDE,
    });
  });
}

export type BulkPageAction =
  | "publish"
  | "unpublish"
  | "trash"
  | "restore"
  | "purge";

export async function bulkPages(
  ids: string[],
  action: BulkPageAction,
  userId: string,
  opts?: { isOwner?: boolean },
) {
  const unique = [...new Set(ids)].slice(0, 100);
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const id of unique) {
    try {
      if (action === "publish") {
        await publishPage(id, userId, "массовая публикация");
      } else if (action === "unpublish") {
        await unpublishPage(id, userId);
      } else if (action === "trash") {
        await softDeletePage(id, userId);
      } else if (action === "restore") {
        await restorePage(id, userId);
      } else if (action === "purge") {
        if (!opts?.isOwner) {
          throw Object.assign(new Error("Только OWNER"), {
            status: 403,
            code: "FORBIDDEN",
          });
        }
        await purgePage(id);
      }
      results.push({ id, ok: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ошибка";
      results.push({ id, ok: false, error: message });
    }
  }

  return {
    results,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}
