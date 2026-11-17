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

  it("hero feats: title + text без склейки", () => {
    const html = renderBlock({
      type: "hero",
      data: {
        title: "Главная",
        titleAccent: "vaybik",
        buttons: [],
        feats: [{ title: "Сайт = заявки", text: "путь клиента", icon: "<svg></svg>" }],
      },
    });
    expect(html).toContain("<b>Сайт = заявки</b><span>путь клиента</span>");
    expect(html).not.toContain("заявкипуть");
  });

  it("cards dir-link и teaser", () => {
    const html = renderBlock({
      type: "cards",
      data: {
        columns: 3,
        items: [
          {
            title: "CRM",
            text: "Воронка",
            cardStyle: "dir-link",
            link: { href: "/avtomatizaciya/#dir-3", label: "Подробнее" },
          },
          {
            title: "ИИ",
            text: "Сценарии",
            kicker: "Вайбик",
            cardStyle: "teaser",
            link: { href: "/keysy-ii/", label: "Смотреть" },
            image: "/img/vaybik-privet.png",
          },
        ],
      },
    });
    expect(html).toContain('class="card dir-link reveal"');
    expect(html).toContain('class="card vaybik-teaser reveal"');
    expect(html).toContain("</div><a class=\"card vaybik-teaser");
  });

  it("cases portfolio: Было/Сделали", () => {
    const html = renderBlock({
      type: "cases",
      data: {
        variant: "portfolio",
        items: [
          {
            title: "Клиника ДНК",
            tag: "Кейс",
            before: "Старый сайт",
            didHtml: "<ul><li>редизайн</li></ul>",
            result: "Заявки выросли",
            image: "/img/case-dnk.jpg",
            href: "https://dnk-med.ru/",
            more: "Открыть dnk-med.ru",
          },
        ],
      },
    });
    expect(html).toContain("<dt>Было</dt>");
    expect(html).toContain("<dt>Сделали</dt>");
    expect(html).toContain("редизайн");    expect(html).toContain('class="card case reveal"');
  });
});