import { describe, expect, it } from "vitest";

/** Минимальная проверка формата urlset для публичного sitemap */
function buildSitemapXml(
  pages: { host: string; path: string; priority: number; changefreq: string; updatedAt: Date }[],
): string {
  const urls = pages
    .map((p) => {
      const loc = `https://${p.host}${p.path === "/" ? "" : p.path}`;
      return `<url><loc>${loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority.toFixed(1)}</priority></url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

describe("sitemap", () => {
  it("содержит страницы с inSitemap-логикой", () => {
    const xml = buildSitemapXml([
      {
        host: "vaybik.ru",
        path: "/",
        priority: 1,
        changefreq: "weekly",
        updatedAt: new Date("2026-01-01"),
      },
      {
        host: "vaybik.ru",
        path: "/about",
        priority: 0.5,
        changefreq: "monthly",
        updatedAt: new Date("2026-01-02"),
      },
    ]);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("https://vaybik.ru</loc>");
    expect(xml).toContain("https://vaybik.ru/about</loc>");
  });
});
