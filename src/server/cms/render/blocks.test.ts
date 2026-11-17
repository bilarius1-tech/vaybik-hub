import { describe, expect, it } from "vitest";
import { renderBlock, renderBlocks } from "./blocks";

describe("renderBlock", () => {
  it("рендерит faq", () => {
    const html = renderBlock({
      type: "faq",
      anchor: "faq",
      data: {
        header: { title: "Вопросы" },
        items: [{ question: "Сколько?", answer: "от **35 000** ₽" }],
      },
    });
    expect(html).toContain('id="faq"');
    expect(html).toContain("Сколько?");
    expect(html).toContain("<strong>35 000</strong>");
  });

  it("скрытые блоки не рендерит", () => {
    expect(
      renderBlock({ type: "text", isHidden: true, data: { markdown: "x" } }),
    ).toBe("");
  });

  it("rawHtml проходит санитайзер", () => {
    const html = renderBlock({
      type: "rawHtml",
      data: { html: '<section class="sec"><p>ok</p><script>x</script></section>' },
    });
    expect(html).toContain("<p>ok</p>");
    expect(html).not.toContain("script");
  });

  it("несколько блоков подряд", () => {
    const html = renderBlocks([
      {
        type: "hero",
        data: { title: "Главная", titleAccent: "vaybik", buttons: [] },
      },
      { type: "cta", data: { title: "Связь", buttons: [] } },
    ]);
    expect(html).toContain("hero");
    expect(html).toContain("Связь");
  });
});
