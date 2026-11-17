import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/server/auth/require";
import { renderPreviewDocument, type NavRenderItem } from "@/server/cms/render/document";
import type { RenderBlock } from "@/server/cms/render/blocks";
import { prisma } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

function assetsOrigin(): string {
  return (
    process.env.SITE_ASSETS_ORIGIN?.replace(/\/$/, "") ||
    "https://vaybik.ru"
  );
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("content.manage");
  } catch {
    const login = new URL("/admin/login", req.url);
    login.searchParams.set("next", `/site-preview/${(await ctx.params).id}`);
    return NextResponse.redirect(login);
  }

  const { id } = await ctx.params;
  const revId = req.nextUrl.searchParams.get("rev");

  const page = await prisma.page.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!page) {
    return new NextResponse("Страница не найдена", { status: 404 });
  }

  let blocks: RenderBlock[];
  let banner: string;
  let title = page.title;
  let template = page.template;

  if (revId && revId !== "draft") {
    const rev = await prisma.pageRevision.findFirst({
      where: { id: revId, pageId: id },
    });
    if (!rev) {
      return new NextResponse("Ревизия не найдена", { status: 404 });
    }
    const snap = rev.snapshot as {
      page?: { title?: string; template?: string };
      blocks?: RenderBlock[];
    };
    blocks = (snap.blocks || []).map((b) => ({
      type: b.type,
      data: b.data,
      isHidden: b.isHidden,
      anchor: b.anchor,
    }));
    title = snap.page?.title || title;
    template = snap.page?.template || template;
    const when = rev.createdAt.toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
    });
    banner = `Предпросмотр · версия от ${when}${rev.note ? ` · ${rev.note}` : ""}`;
  } else {
    blocks = page.blocks.map((b) => ({
      type: b.type,
      data: b.data,
      isHidden: b.isHidden,
      anchor: b.anchor,
    }));
    banner = "Предпросмотр · черновик";
  }

  const navRows = await prisma.navItem.findMany({
    include: { page: { select: { path: true } } },
    orderBy: [{ menu: "asc" }, { sortOrder: "asc" }],
  });

  const nav: NavRenderItem[] = navRows.map((n) => ({
    id: n.id,
    menu: n.menu,
    parentId: n.parentId,
    label: n.label,
    url: n.url,
    pagePath: n.page?.path ?? null,
    isHidden: n.isHidden,
    isHighlighted: n.isHighlighted,
    openInNewTab: n.openInNewTab,
    sortOrder: n.sortOrder,
  }));

  const html = renderPreviewDocument({
    title,
    template,
    blocks,
    nav,
    assetsOrigin: assetsOrigin(),
    banner,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });
}
