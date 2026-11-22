import {
  Prisma,
  type PrismaClient,
  type Service,
  type ServiceSeo,
} from "@prisma/client";
import { bumpSiteVersion } from "@/server/cms/site-version";
import { ensureAdminDisallow } from "@/server/seo/robots-normalize";
import {
  SEO_PUBLIC_DENY_SLUGS,
  SITE_CMS_SLUG,
  defaultJsonLd,
  defaultLlmsTxt,
  defaultRobotsTxt,
  hubOrigin,
  publicServiceIconUrl,
} from "./seo-defaults";
import type { ServiceSeoUpdateInput } from "./seo-schemas";
import { FAVICON_FILES } from "./seo-favicon";

type Db = PrismaClient | Prisma.TransactionClient;

export type ServiceWithSeo = Service & { seo: ServiceSeo | null };

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "vaybik.ru";
  }
}

function asCounters(value: unknown): {
  yandexWebmaster?: string | null;
  yandexMetrika?: string | null;
  googleSearchConsole?: string | null;
  googleAnalytics?: string | null;
} {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, string | null | undefined>;
}

function settingText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

/** Создаёт ServiceSeo с дефолтами; для vaybik-site-cms подтягивает Setting. */
export async function ensureServiceSeo(
  db: Db,
  service: Service,
): Promise<ServiceSeo> {
  const existing = await db.serviceSeo.findUnique({
    where: { serviceId: service.id },
  });
  if (existing) return existing;

  const host = hostFromUrl(service.url);
  const sitemapUrl =
    host === "vaybik.ru"
      ? "https://vaybik.ru/sitemap.xml"
      : `${service.url.replace(/\/$/, "")}/sitemap.xml`;

  let robotsTxt = defaultRobotsTxt({
    host,
    sitemapUrl,
    extraDisallow:
      service.slug === "chat" || service.slug === "lead"
        ? ["/manage/", "/api/"]
        : service.slug === "mockup"
          ? ["/api/"]
          : [],
  });
  let llmsTxt = defaultLlmsTxt({
    name: service.name,
    url: service.url,
    description: service.description,
  });
  let yandexMetrika: string | null = null;
  let yandexWebmaster: string | null = null;
  let googleSearchConsole: string | null = null;
  let googleAnalytics: string | null = null;

  if (service.slug === SITE_CMS_SLUG) {
    const rows = await db.setting.findMany({
      where: {
        key: { in: ["seo.counters", "site.robots", "site.llms"] },
      },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const counters = asCounters(map.get("seo.counters"));
    yandexMetrika = counters.yandexMetrika?.trim() || null;
    yandexWebmaster = counters.yandexWebmaster?.trim() || null;
    googleSearchConsole = counters.googleSearchConsole?.trim() || null;
    googleAnalytics = counters.googleAnalytics?.trim() || null;
    const fromRobots = settingText(map.get("site.robots")).trim();
    const fromLlms = settingText(map.get("site.llms")).trim();
    if (fromRobots) robotsTxt = ensureAdminDisallow(fromRobots);
    if (fromLlms) llmsTxt = fromLlms;
  }

  // Добавить YandexGPT в унаследованный robots, если его нет
  if (!/User-agent:\s*YandexGPT/i.test(robotsTxt)) {
    robotsTxt = robotsTxt.replace(
      /(User-agent:\s*YandexBot\nAllow: \/\nDisallow: \/admin\/\n)/i,
      `$1\nUser-agent: YandexGPT\nAllow: /\nDisallow: /admin/\n`,
    );
    if (!/User-agent:\s*YandexGPT/i.test(robotsTxt)) {
      robotsTxt = `${robotsTxt.trimEnd()}\n\nUser-agent: YandexGPT\nAllow: /\nDisallow: /admin/\n`;
    }
  }
  robotsTxt = ensureAdminDisallow(robotsTxt);

  const jsonLd = defaultJsonLd({
    name: service.name,
    url: service.url,
    description: service.description,
    isProduct: service.isProduct,
  });

  return db.serviceSeo.create({
    data: {
      serviceId: service.id,
      title: service.name,
      description: service.description,
      canonical: service.url.replace(/\/$/, "") + "/",
      robots: "index,follow",
      robotsTxt,
      llmsTxt,
      sitemapUrl,
      yandexMetrika,
      yandexWebmaster,
      googleSearchConsole,
      googleAnalytics,
      jsonLd: jsonLd as Prisma.InputJsonValue,
    },
  });
}

export async function getServiceSeoForAdmin(
  db: Db,
  serviceId: string,
): Promise<{ service: Service; seo: ServiceSeo } | null> {
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) return null;
  const seo = await ensureServiceSeo(db, service);
  return { service, seo };
}

function pickDefined<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Не затираем непустые поля пустыми строками/null из миграции — только явный апдейт формы. */
export async function updateServiceSeo(
  db: PrismaClient,
  serviceId: string,
  input: ServiceSeoUpdateInput,
  actorId: string | null,
): Promise<ServiceSeo> {
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error("SERVICE_NOT_FOUND");
  await ensureServiceSeo(db, service);

  const data = pickDefined({
    title: input.title,
    description: input.description,
    canonical: input.canonical,
    robots: input.robots,
    ogTitle: input.ogTitle,
    ogDescription: input.ogDescription,
    ogImage: input.ogImage,
    twitterCard: input.twitterCard,
    jsonLd:
      input.jsonLd === undefined
        ? undefined
        : input.jsonLd === null
          ? Prisma.DbNull
          : (input.jsonLd as Prisma.InputJsonValue),
    yandexMetrika: input.yandexMetrika,
    yandexWebmaster: input.yandexWebmaster,
    googleSearchConsole: input.googleSearchConsole,
    googleAnalytics: input.googleAnalytics,
    robotsTxt:
      input.robotsTxt != null
        ? ensureAdminDisallow(input.robotsTxt)
        : input.robotsTxt,
    llmsTxt: input.llmsTxt,
    sitemapUrl: input.sitemapUrl,
  });

  const seo = await db.serviceSeo.update({
    where: { serviceId },
    data,
  });

  // Синхронизация Setting для главной (обратная совместимость /admin/seo)
  if (service.slug === SITE_CMS_SLUG) {
    const counters = {
      yandexWebmaster: seo.yandexWebmaster,
      yandexMetrika: seo.yandexMetrika,
      googleSearchConsole: seo.googleSearchConsole,
      googleAnalytics: seo.googleAnalytics,
    };
    await db.setting.upsert({
      where: { key: "seo.counters" },
      create: {
        key: "seo.counters",
        value: counters,
        updatedBy: actorId,
      },
      update: { value: counters, updatedBy: actorId },
    });
    if (seo.robotsTxt) {
      await db.setting.upsert({
        where: { key: "site.robots" },
        create: {
          key: "site.robots",
          value: seo.robotsTxt,
          updatedBy: actorId,
        },
        update: { value: seo.robotsTxt, updatedBy: actorId },
      });
    }
    if (seo.llmsTxt) {
      await db.setting.upsert({
        where: { key: "site.llms" },
        create: {
          key: "site.llms",
          value: seo.llmsTxt,
          updatedBy: actorId,
        },
        update: { value: seo.llmsTxt, updatedBy: actorId },
      });
    }
    await bumpSiteVersion(db, "service-seo.site-cms");
  }

  return seo;
}

export type PublicServiceSeoPayload = {
  slug: string;
  host: string;
  url: string;
  name: string;
  title: string | null;
  description: string | null;
  robots: string;
  canonical: string | null;
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
  };
  twitterCard: string | null;
  jsonLd: unknown;
  favicon: {
    ico: string | null;
    png32: string | null;
    appleTouch180: string | null;
    icon192: string | null;
    icon512: string | null;
    manifest: string | null;
    svg: string | null;
  } | null;
  analytics: {
    yandexMetrika: string | null;
    yandexWebmaster: string | null;
    googleSearchConsole: string | null;
    googleAnalytics: string | null;
  };
  robotsTxt: string | null;
  llmsTxt: string | null;
  sitemapUrl: string | null;
};

export async function buildPublicServiceSeo(
  db: Db,
  slug: string,
): Promise<PublicServiceSeoPayload | null> {
  if (SEO_PUBLIC_DENY_SLUGS.has(slug)) return null;
  const service = await db.service.findUnique({ where: { slug } });
  if (!service) return null;
  const seo = await ensureServiceSeo(db, service);
  const host = hostFromUrl(service.url);

  let favicon: PublicServiceSeoPayload["favicon"] = null;
  if (seo.faviconGeneratedAt) {
    const icon = (file: string) => publicServiceIconUrl(slug, file);
    favicon = {
      ico: icon("favicon.ico"),
      png32: icon("favicon-32.png"),
      appleTouch180: icon("apple-touch-icon.png"),
      icon192: icon("icon-192.png"),
      icon512: icon("icon-512.png"),
      manifest: icon("site.webmanifest"),
      svg:
        seo.faviconSourceMime === "image/svg+xml" && seo.faviconSourceFile
          ? icon(seo.faviconSourceFile)
          : null,
    };
  }

  return {
    slug: service.slug,
    host,
    url: service.url,
    name: service.name,
    title: seo.title,
    description: seo.description,
    robots: seo.robots,
    canonical: seo.canonical,
    og: {
      title: seo.ogTitle || seo.title,
      description: seo.ogDescription || seo.description,
      image: seo.ogImage,
    },
    twitterCard: seo.twitterCard,
    jsonLd: seo.jsonLd,
    favicon,
    analytics: {
      yandexMetrika: seo.yandexMetrika,
      yandexWebmaster: seo.yandexWebmaster,
      googleSearchConsole: seo.googleSearchConsole,
      googleAnalytics: seo.googleAnalytics,
    },
    robotsTxt: seo.robotsTxt,
    llmsTxt: seo.llmsTxt,
    sitemapUrl: seo.sitemapUrl,
  };
}

/** Для site-сервера: SEO главной + аналитика. */
export async function loadSiteCmsSeo(db: Db): Promise<{
  robotsTxt: string | null;
  llmsTxt: string | null;
  analytics: PublicServiceSeoPayload["analytics"];
  favicon: PublicServiceSeoPayload["favicon"];
  domainSeo: {
    title: string | null;
    description: string | null;
    robots: string | null;
    canonical: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    jsonLd: unknown;
  } | null;
  privacyUrl: string;
} | null> {
  const service = await db.service.findUnique({
    where: { slug: SITE_CMS_SLUG },
  });
  if (!service) return null;
  const payload = await buildPublicServiceSeo(db, SITE_CMS_SLUG);
  if (!payload) return null;
  return {
    robotsTxt: payload.robotsTxt,
    llmsTxt: payload.llmsTxt,
    analytics: payload.analytics,
    favicon: payload.favicon
      ? {
          ...payload.favicon,
          // На публичном сайте удобнее абсолютные URL хаба
          ico: payload.favicon.ico,
          png32: payload.favicon.png32,
          appleTouch180: payload.favicon.appleTouch180,
          icon192: payload.favicon.icon192,
          icon512: payload.favicon.icon512,
          manifest: payload.favicon.manifest,
          svg: payload.favicon.svg,
        }
      : null,
    domainSeo: {
      title: payload.title,
      description: payload.description,
      robots: payload.robots,
      canonical: payload.canonical,
      ogTitle: payload.og?.title ?? null,
      ogDescription: payload.og?.description ?? null,
      ogImage: payload.og?.image ?? null,
      twitterCard: payload.twitterCard,
      jsonLd: payload.jsonLd,
    },
    privacyUrl: "https://chat.vaybik.ru/privacy",
  };
}

export { FAVICON_FILES, hubOrigin };
