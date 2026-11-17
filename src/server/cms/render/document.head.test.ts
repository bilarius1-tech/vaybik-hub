import { describe, expect, it } from "vitest";
import { renderSiteDocument } from "./document";

describe("renderSiteDocument head", () => {
  it("отдаёт полный набор мета в public", () => {
    const html = renderSiteDocument({
      mode: "public",
      title: "Тест",
      path: "/uslugi/",
      template: "default",
      blocks: [],
      nav: [],
      seo: {
        title: "Услуги — vaybik.ru",
        description: "Описание услуг",
        robots: "index,follow,max-image-preview:large",
        ogTitle: "Услуги",
        ogDescription: "Описание услуг",
        ogImage: "https://vaybik.ru/img/og.jpg",
        jsonLd: { "@context": "https://schema.org", "@type": "WebPage" },
      },
      assetsOrigin: "https://vaybik.ru",
      siteOrigin: "https://vaybik.ru",
    });
    expect(html).toContain('name="viewport"');
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain("<link rel=\"canonical\"");
    expect(html).toContain("theme-color");
    expect(html).toContain("og:image:width");
    expect(html).toContain("twitter:card");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("site.css?v=13");
    expect(html).toContain("main.js?v=2");
    expect(html).toContain("hdr-cta");
    expect(html).toContain('id="menu"');
  });

  it("preview без JS и с noindex", () => {
    const html = renderSiteDocument({
      mode: "preview",
      title: "Черновик",
      path: "/",
      template: "home",
      blocks: [],
      nav: [],
      assetsOrigin: "https://vaybik.ru",
      siteOrigin: "https://vaybik.ru",
      banner: "Предпросмотр",
    });
    expect(html).toContain("noindex");
    expect(html).not.toContain("main.js");
    expect(html).toContain("cms-preview-banner");
  });
});
