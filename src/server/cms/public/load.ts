import type { PrismaClient } from "@prisma/client";
import { collectMediaRefs } from "../media/usage";
import type { MediaVariant } from "../media/url";
import type { MediaAssetInfo, MediaRenderContext } from "../render/media";
import type { RenderBlock } from "../render/blocks";
import type {
  ContactsRender,
  NavRenderItem,
  SeoRenderData,
} from "../render/document";
import type { SiteAssetVersions } from "../render/assets";
import { isPublicPage, publicPageWhere } from "./visibility";

type Db = PrismaClient;

export type LoadedPublicPage = {
  page: {
    id: string;
    path: string;
    title: string;
    template: string;
    status: string;
    publishedAt: Date | null;
    publishedRevisionId: string;
  };
  blocks: RenderBlock[];
  seo: SeoRenderData | null;
  nav: NavRenderItem[];
  contacts: ContactsRender;
  assetVersions: Partial<SiteAssetVersions> | null;
  media: MediaRenderContext;
  /** Гарантия: таблица Block не читалась */
  source: "revision";
};

async function loadNav(db: Db): Promise<NavRenderItem[]> {
  const rows = await db.navItem.findMany({
    include: { page: { select: { path: true, deletedAt: true } } },
    orderBy: [{ menu: "asc" }, { sortOrder: "asc" }],
  });
  return rows.map((n) => ({
    id: n.id,
    menu: n.menu,
    parentId: n.parentId,
    label: n.label,
    url: n.url,
    pagePath:
      n.page && !n.page.deletedAt ? n.page.path : (n.page?.path ?? null),
    isHidden: n.isHidden,
    isHighlighted: n.isHighlighted,
    openInNewTab: n.openInNewTab,
    sortOrder: n.sortOrder,
  }));
}

async function loadSettings(db: Db): Promise<{
  contacts: ContactsRender;
  assetVersions: Partial<SiteAssetVersions> | null;
}> {
  const rows = await db.setting.findMany({
    where: { key: { in: ["site.contacts", "site.assets"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const contactsRaw = map.get("site.contacts") as ContactsRender | undefined;
  const assetsRaw = map.get("site.assets") as
    | Partial<SiteAssetVersions>
    | undefined;
  return {
    contacts: {
      email: contactsRaw?.email || null,
      telegram: contactsRaw?.telegram || null,
    },
    assetVersions: assetsRaw || null,
  };
}

async function loadMediaMap(
  db: Db,
  blocks: RenderBlock[],
  mediaBase: string,
  warn?: (msg: string) => void,
): Promise<MediaRenderContext> {
  const ids = new Set<string>();
  for (const b of blocks) {
    for (const ref of collectMediaRefs(b.type, b.data)) {
      ids.add(ref.mediaId);
    }
  }
  const mediaById = new Map<string, MediaAssetInfo>();
  if (ids.size) {
    const assets = await db.mediaAsset.findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
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
  return { mediaBase, mediaById, warn };
}

function seoFromRow(
  row: {
    title: string | null;
    description: string | null;
    canonical: string | null;
    robots: string;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    jsonLd: unknown;
  } | null,
): SeoRenderData | null {
  if (!row) return null;
  return {
    title: row.title,
    description: row.description,
    canonical: row.canonical,
    robots: row.robots,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImage: row.ogImage,
    twitterCard: row.twitterCard,
    jsonLd: row.jsonLd,
  };
}

/**
 * Загрузка опубликованной страницы по path.
 * Контент — только из PageRevision.snapshot (таблица Block не читается).
 */
export async function loadPublicPageByPath(
  db: Db,
  path: string,
  opts: { mediaBase: string; warn?: (msg: string) => void },
): Promise<LoadedPublicPage | null> {
  const page = await db.page.findFirst({
    where: { path, ...publicPageWhere() },
    select: {
      id: true,
      path: true,
      title: true,
      template: true,
      status: true,
      publishedAt: true,
      publishedRevisionId: true,
      deletedAt: true,
      seoPage: true,
    },
  });
  if (!page || !isPublicPage(page) || !page.publishedRevisionId) {
    return null;
  }

  const rev = await db.pageRevision.findUnique({
    where: { id: page.publishedRevisionId },
  });
  if (!rev) return null;

  const snap = rev.snapshot as {
    page?: { title?: string; template?: string };
    blocks?: RenderBlock[];
  };
  // Только snapshot — таблица Block не читается
  const blocks: RenderBlock[] = (snap.blocks || []).map((b) => ({
    type: b.type,
    data: b.data,
    isHidden: b.isHidden,
    anchor: b.anchor,
  }));

  const [nav, settings, media] = await Promise.all([
    loadNav(db),
    loadSettings(db),
    loadMediaMap(db, blocks, opts.mediaBase, opts.warn),
  ]);

  return {
    page: {
      id: page.id,
      path: page.path,
      title: snap.page?.title || page.title,
      // template берём с Page (можно сменить без republish); snapshot — запасной
      template: page.template || snap.page?.template || "default",
      status: page.status,
      publishedAt: page.publishedAt,
      publishedRevisionId: page.publishedRevisionId,
    },
    blocks,
    seo: seoFromRow(page.seoPage),
    nav,
    contacts: settings.contacts,
    assetVersions: settings.assetVersions,
    media,
    source: "revision",
  };
}

/** Общие данные сайта (меню/контакты/версии) — для 404 и т.п. */
export async function loadSiteChrome(db: Db): Promise<{
  nav: NavRenderItem[];
  contacts: ContactsRender;
  assetVersions: Partial<SiteAssetVersions> | null;
}> {
  const [nav, settings] = await Promise.all([loadNav(db), loadSettings(db)]);
  return {
    nav,
    contacts: settings.contacts,
    assetVersions: settings.assetVersions,
  };
}

export async function listPublicPathsForSitemap(db: Db): Promise<
  Array<{
    path: string;
    host: string;
    priority: number;
    changefreq: string;
    lastmod: Date;
  }>
> {
  const pages = await db.page.findMany({
    where: publicPageWhere(),
    select: {
      path: true,
      publishedAt: true,
      updatedAt: true,
      seoPage: {
        select: {
          host: true,
          inSitemap: true,
          priority: true,
          changefreq: true,
          updatedAt: true,
        },
      },
    },
  });
  return pages
    .filter((p) => p.seoPage?.inSitemap)
    .map((p) => ({
      path: p.path,
      host: p.seoPage!.host,
      priority: p.seoPage!.priority,
      changefreq: p.seoPage!.changefreq,
      lastmod: p.publishedAt || p.seoPage!.updatedAt || p.updatedAt,
    }));
}
