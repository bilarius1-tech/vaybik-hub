import { describe, expect, it } from "vitest";
import { clearWidgetCache, renderWidgetHtml } from "./widgets";

describe("renderWidgetHtml calcMini", () => {
  it("всегда берёт шаблон с form#calc, даже при обрезанном снимке", () => {
    clearWidgetCache();
    const html = renderWidgetHtml(
      {
        key: "calcMini",
        htmlSnapshot:
          '<section id="calc-sec"><div>Лендинг<small>от 20 000 ₽</small></div></section>',
        showMore: true,
      },
      "public",
    );
    expect(html).toMatch(/<form[^>]*id="calc"/);
    expect(html.match(/<input\b/g)?.length).toBe(15);
    expect(html.match(/<fieldset\b/g)?.length).toBe(3);
    expect(html).toContain("<output");
    expect(html).toMatch(/viewBox="0 0 24 24"/i);
    expect(html).toContain("calc-more");
  });

  it("showMore:false убирает calc-more", () => {
    clearWidgetCache();
    const html = renderWidgetHtml(
      {
        key: "calcMini",
        htmlSnapshot: "<div></div>",
        showMore: false,
      },
      "preview",
    );
    expect(html).toContain('id="calc"');
    expect(html).not.toContain("calc-more");
  });

  it("без showMore смотрит на снимок (calc-more → true)", () => {
    clearWidgetCache();
    const withMore = renderWidgetHtml(
      {
        key: "calcMini",
        htmlSnapshot: '<p class="calc-more"><a href="/kalkulyator/">x</a></p>',
      },
      "public",
    );
    expect(withMore).toContain("calc-more");
    const without = renderWidgetHtml(
      { key: "calcMini", htmlSnapshot: "<div>no more</div>" },
      "public",
    );
    expect(without).not.toContain("calc-more");
  });
});
