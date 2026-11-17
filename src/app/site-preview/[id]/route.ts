import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/server/auth/require";
import { collectMediaRefs } from "@/server/cms/media/usage";
import type { MediaVariant } from "@/server/cms/media/url";
import { renderSiteDocument, type NavRenderItem } from "@/server/cms/render/document";
import type { MediaAssetInfo } from "@/server/cms/render/media";
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
  const embed = req.nextUrl.searchParams.get("embed") === "1";

  const page = await prisma.page.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { sortOrder: "asc" } },
      seoPage: true,
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
    banner = embed
      ? ""
      : `Предпросмотр · версия от ${when}${rev.note ? ` · ${rev.note}` : ""}`;
  } else {
    blocks = page.blocks.map((b) => ({
      type: b.type,
      data: b.data,
      isHidden: b.isHidden,
      anchor: b.anchor,
    }));
    banner = embed ? "" : "Предпросмотр · черновик";
  }

  const mediaIds = new Set<string>();
  for (const b of blocks) {
    for (const ref of collectMediaRefs(b.type, b.data)) {
      mediaIds.add(ref.mediaId);
    }
  }
  const mediaById = new Map<string, MediaAssetInfo>();
  if (mediaIds.size) {
    const assets = await prisma.mediaAsset.findMany({
      where: { id: { in: [...mediaIds] }, deletedAt: null },
    });
    for (const a of assets) {
      mediaById.set(a.id, {
        id: a.id,
        version: a.version,
        alt: a.alt,
        width: a.width,
        height: a.height,
        variants: (a.variants as MediaVariant[]) || [],
      });
    }
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

  const contactsRow = await prisma.setting.findUnique({
    where: { key: "site.contacts" },
  });
  const contacts = (contactsRow?.value || {}) as {
    email?: string;
    telegram?: string;
  };

  const html = renderSiteDocument({
    mode: "preview",
    title,
    path: page.path,
    template,
    blocks,
    nav,
    seo: page.seoPage,
    contacts,
    assetsOrigin: assetsOrigin(),
    siteOrigin: assetsOrigin(),
    media: {
      mediaBase: "/admin/api/public/media",
      mediaById,
    },
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
