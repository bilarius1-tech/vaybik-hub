import { describe, expect, it } from "vitest";
import {
  SEO_PUBLIC_DENY_SLUGS,
  defaultRobotsTxt,
} from "./seo-defaults";

describe("seo-defaults", () => {
  it("robots шаблон содержит YandexGPT и Host/Sitemap", () => {
    const txt = defaultRobotsTxt({
      host: "chat.vaybik.ru",
      sitemapUrl: "https://chat.vaybik.ru/sitemap.xml",
      extraDisallow: ["/manage/", "/api/"],
    });
    expect(txt).toMatch(/User-agent:\s*YandexGPT/);
    expect(txt).toContain("Host: chat.vaybik.ru");
    expect(txt).toContain("Sitemap: https://chat.vaybik.ru/sitemap.xml");
    expect(txt).toContain("Disallow: /manage/");
  });

  it("region в denylist публичного SEO", () => {
    expect(SEO_PUBLIC_DENY_SLUGS.has("region")).toBe(true);
  });
});
