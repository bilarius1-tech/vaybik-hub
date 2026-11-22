import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
const create = vi.fn();
const seoFindUnique = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {},
}));

vi.mock("@/server/cms/site-version", () => ({
  bumpSiteVersion: vi.fn(),
}));

import { buildPublicServiceSeo } from "./seo";

describe("buildPublicServiceSeo", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findMany.mockReset();
    create.mockReset();
    seoFindUnique.mockReset();
  });

  function db() {
    return {
      service: { findUnique },
      serviceSeo: { findUnique: seoFindUnique, create },
      setting: { findMany },
    } as never;
  }

  it("region → null (404 на эндпоинте)", async () => {
    const r = await buildPublicServiceSeo(db(), "region");
    expect(r).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("неизвестный slug → null", async () => {
    findUnique.mockResolvedValue(null);
    const r = await buildPublicServiceSeo(db(), "nope");
    expect(r).toBeNull();
  });

  it("собирает payload с кэш-дружелюбными полями", async () => {
    findUnique.mockResolvedValue({
      id: "s1",
      slug: "chat",
      name: "Вайбик Чат",
      url: "https://chat.vaybik.ru",
      description: "Чат",
      isProduct: true,
    });
    seoFindUnique.mockResolvedValue({
      id: "seo1",
      serviceId: "s1",
      title: "Чат",
      description: "Описание",
      canonical: "https://chat.vaybik.ru/",
      robots: "index,follow",
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      twitterCard: "summary_large_image",
      jsonLd: { "@type": "WebApplication" },
      yandexMetrika: "1",
      yandexWebmaster: "w",
      googleSearchConsole: "g",
      googleAnalytics: null,
      robotsTxt: "User-agent: *\nAllow: /\n",
      llmsTxt: "# chat",
      sitemapUrl: "https://chat.vaybik.ru/sitemap.xml",
      faviconSourceFile: null,
      faviconSourceMime: null,
      faviconGeneratedAt: null,
    });
    const r = await buildPublicServiceSeo(db(), "chat");
    expect(r?.slug).toBe("chat");
    expect(r?.host).toBe("chat.vaybik.ru");
    expect(r?.analytics.yandexMetrika).toBe("1");
    expect(r?.favicon).toBeNull();
    expect(r?.robotsTxt).toContain("User-agent");
  });
});
