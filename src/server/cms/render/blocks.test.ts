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

  it("hero: пустой feats не рендерит .feats; icon внутри bt-sl", () => {
    const empty = renderBlock({
      type: "hero",
      data: {
        title: "Услуги",
        variant: "sub",
        buttons: [
          {
            label: "Звонок",
            href: "tel:+7999",
            className: "bt-call",
            icon: '<svg class="ic" viewBox="0 0 24 24"></svg>',
          },
        ],
        feats: [],
      },
    });
    expect(empty).not.toContain('class="feats"');
    expect(empty).toContain('class="bt-btn bt-call "');
    expect(empty).toMatch(/<span class="bt-sl"><svg/);
  });

  it("hero: svc-sub перед brand", () => {
    const html = renderBlock({
      type: "hero",
      data: {
        title: "1С",
        variant: "service",
        svcSubHtml: '<ul class="svc-sub"><li><a href="/">Главная</a></li></ul>',
        brandHtml: '<div class="brand-lockup">b</div>',
        buttons: [],
      },
    });
    const sub = html.indexOf('class="svc-sub"');
    const brand = html.indexOf('class="brand-lockup"');
    expect(sub).toBeGreaterThan(-1);
    expect(brand).toBeGreaterThan(sub);
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
            imageWidth: 782,
            imageHeight: 1588,
            href: "https://dnk-med.ru/",
            more: "Открыть dnk-med.ru",
          },
        ],
      },
    });
    expect(html).toContain("<dt>Было</dt>");
    expect(html).toContain("<dt>Сделали</dt>");
    expect(html).toContain("редизайн");
    expect(html).toContain('class="card case reveal"');
    expect(html).toContain('class="grid"');
    expect(html).not.toContain('class="grid g3"');
    expect(html).toContain("<picture>");
    expect(html).toContain("case-dnk-400.webp");
  });

  it("cards more с aria-label по title", () => {
    const html = renderBlock({
      type: "cards",
      data: {
        columns: 3,
        items: [
          {
            title: "Landing Page",
            text: "Лендинг",
            link: { href: "/uslugi/landing/", label: "Подробнее" },
          },
        ],
      },
    });
    expect(html).toContain('aria-label="Подробнее: Landing Page"');
  });

  it("serviceCards: columns=4 → grid g4", () => {
    const html = renderBlock({
      type: "serviceCards",
      anchor: "our-services",
      data: {
        header: { title: "Наши сервисы" },
        columns: 4,
        items: [
          { title: "A", textHtml: "<p>a</p>" },
          { title: "B", textHtml: "<p>b</p>" },
          { title: "C", textHtml: "<p>c</p>" },
          { title: "D", textHtml: "<p>d</p>" },
        ],
      },
    });
    expect(html).toContain('class="grid g4 svc-cards"');
  });

  it("serviceCards: H2/H3, picture lazy, кнопка", () => {
    const html = renderBlock({
      type: "serviceCards",
      anchor: "our-services",
      data: {
        header: { title: "Наши сервисы" },
        columns: 3,
        items: [
          {
            title: "Консультант на сайт",
            textHtml: "<p>ИИ отвечает 24/7</p>",
            price: "От 1 700 ₽/мес.",
            image: { src: "/img/service-consultant.jpg", alt: null },
            button: {
              label: "Попробовать",
              href: "https://chat.vaybik.ru",
              style: "primary",
            },
          },
          {
            title: "Лидогенерация",
            text: "Заявки с бирж",
            button: {
              label: "Подробнее",
              href: "#contact",
              style: "secondary",
            },
          },
        ],
      },
    });
    expect(html).toContain('id="our-services"');
    expect(html).toContain('id="our-services-title"');
    expect(html).toContain("<h2 id=\"our-services-title\">Наши сервисы</h2>");
    expect(html).toContain("<h3>Консультант на сайт</h3>");
    expect(html).toContain('class="grid g3 svc-cards"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('alt="Консультант на сайт"');
    expect(html).toContain('href="https://chat.vaybik.ru"');
    expect(html).toContain("Попробовать");
    expect(html).toContain('class="more"');
    expect(html).toContain("Подробнее");
  });

  it("keysy rawHtml: фильтры + кнопки диалога после sanitize", () => {
    const html = renderBlock({
      type: "rawHtml",
      data: {
        html: `<div class="k-filters"><div class="k-chips" role="group" aria-label="Фильтр по системам"><label for="kf-all">Все</label></div></div>
<dialog class="k-dlg" id="dlg-case-uk"><div class="k-dlg-inner">
×
<p class="k-ind">UK</p>
<div class="k-dlg-cta acts"><a class="bt-btn" href="https://t.me/bilarius"><span class="bt-sl">Хочу так же</span></a>Закрыть</div>
</div></dialog>`,
      },
    });
    expect(html).toContain('name="kfilter"');
    expect(html).toContain('class="k-dlg-close"');
    expect(html).toContain('class="bt-btn2"');
    expect(html).toContain("data-close-dialog");
  });
});