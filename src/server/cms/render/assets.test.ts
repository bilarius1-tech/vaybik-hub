import { describe, expect, it } from "vitest";
import { assetsForTemplate, LC_BAR_HTML } from "./assets";
import { renderSiteDocument } from "./document";

describe("assetsForTemplate calculator", () => {
  it("подключает calc.css и скрипты в порядке leadweb", () => {
    const a = assetsForTemplate("calculator");
    expect(a.css).toEqual([
      "/css/fonts.css",
      "/css/site.css?v=13",
      "/kalkulyator/calc.css?v=2",
    ]);
    expect(a.js).toEqual([
      "/js/main.js?v=2",
      "/kalkulyator/data.js?v=2",
      "/kalkulyator/content.js?v=2",
      "/kalkulyator/calc.js?v=2",
      "/kalkulyator/client.js?v=2",
    ]);
    expect(a.afterMain).toBe(LC_BAR_HTML);
    expect(a.bodyClass).toBe("lc-page");
  });
});

describe("renderSiteDocument calculator", () => {
  it("один hero из calcFull и lc-bar после main", () => {
    const html = renderSiteDocument({
      mode: "public",
      title: "Калькулятор",
      path: "/kalkulyator/",
      template: "calculator",
      blocks: [
        {
          type: "hero",
          data: {
            variant: "sub",
            title: "Лишний hero",
            mascot: "privet",
          },
        },
        {
          type: "widget",
          data: { key: "calcFull", htmlSnapshot: "" },
        },
      ],
      nav: [],
      assetsOrigin: "https://vaybik.ru",
      siteOrigin: "https://vaybik.ru",
    });
    const heroes = html.match(/<section class="hero/g) || [];
    expect(heroes.length).toBe(1);
    expect(html).toContain("lc-hero");
    expect(html).toContain('id="lcBarSum"');
    expect(html).toMatch(/<\/main>\s*<div class="lc-bar"/);
    expect(html).toContain("/kalkulyator/calc.css?v=2");
    expect(html).toContain("/kalkulyator/client.js?v=2");
    expect(html).not.toContain("Лишний hero");
  });
});
