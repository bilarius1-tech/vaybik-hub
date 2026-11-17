import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { parseBlockData } from "../blocks";
import { sanitizeCmsHtml } from "../sanitize";

export type RecognizedBlock = {
  type: string;
  data: unknown;
  anchor: string | null;
  reason?: string;
};

function text($el: cheerio.Cheerio<AnyNode>): string {
  return $el.text().replace(/\s+/g, " ").trim();
}

function headerFrom($: cheerio.CheerioAPI, section: Element) {
  const h = $(section).find(".sec-h").first();
  if (!h.length) return null;
  return {
    kicker: text(h.find(".kicker").first()) || null,
    title: text(h.find("h2").first()) || null,
    subtitle: text(h.find(".muted").first()) || null,
  };
}

function hasClass(el: Element, name: string): boolean {
  const cls = el.attribs?.class || "";
  return cls.split(/\s+/).includes(name);
}

function sectionOuterHtml($: cheerio.CheerioAPI, section: Element): string {
  return sanitizeCmsHtml($.html(section) || "");
}

function recognizeHero(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  if (!hasClass(section, "hero")) return null;
  const $s = $(section);
  const variant = hasClass(section, "svc-hero")
    ? "service"
    : hasClass(section, "sub")
      ? "sub"
      : "home";
  const h1 = $s.find("h1").first();
  const accent = text(h1.find(".grad").first());
  const titleFull = text(h1);
  const title = accent
    ? titleFull.replace(accent, "").replace(/^[\s—–-]+/, "").trim() || titleFull
    : titleFull;
  const buttons: Array<{ label: string; href: string; style: "primary" | "secondary" }> =
    [];
  $s.find(".acts a").each((_, a) => {
    const $a = $(a);
    const cls = $a.attr("class") || "";
    buttons.push({
      label: text($a),
      href: $a.attr("href") || "#",
      style: cls.includes("bt-btn2") ? "secondary" : "primary",
    });
  });
  const feats: Array<{ icon?: string; title?: string; text: string }> = [];
  $s.find(".feat").each((_, f) => {
    const $f = $(f);
    const icon = $f.find("svg").first().toString() || undefined;
    const title = text($f.find("b").first());
    const desc = text($f.find("span").first());
    if (title && desc) {
      feats.push({ icon, title, text: desc });
    } else {
      feats.push({ icon, text: title || desc || text($f) });
    }
  });
  let rings: unknown = null;
  const ringsAttr = $s.find("[data-magic-rings]").attr("data-magic-rings");
  if (ringsAttr) {
    try {
      rings = JSON.parse(ringsAttr);
    } catch {
      rings = null;
    }
  }
  const data = parseBlockData("hero", {
    variant,
    kicker: text($s.find(".kicker").first()) || null,
    title: title || "Без названия",
    titleAccent: accent || null,
    lead: text($s.find(".lead").first()) || null,
    buttons,
    mascot: "privet",
    feats,
    rings,
  });
  return { type: "hero", data, anchor: section.attribs?.id || null };
}

function recognizeFaq(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  if (!$(section).find(".faq").length) return null;
  const items: Array<{ question: string; answer: string }> = [];
  $(section)
    .find(".faq details")
    .each((_, d) => {
      const $d = $(d);
      items.push({
        question: text($d.find("summary span").first()) || text($d.find("summary")),
        answer: $d.find("div").first().text().trim() || text($d.find("div")),
      });
    });
  if (!items.length) return null;
  return {
    type: "faq",
    data: parseBlockData("faq", {
      header: headerFrom($, section),
      background: hasClass(section, "alt") ? "alt" : "default",
      items,
    }),
    anchor: section.attribs?.id || "faq",
  };
}

function recognizeSteps(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  if (!$(section).find("ol.steps").length) return null;
  const items: Array<{ title: string; text: string; result: string }> = [];
  $(section)
    .find("ol.steps li")
    .each((_, li) => {
      const $li = $(li);
      items.push({
        title: text($li.find("b").first()),
        text: text($li.find("span").first()),
        result: text($li.find("em").first()),
      });
    });
  return {
    type: "steps",
    data: parseBlockData("steps", {
      header: headerFrom($, section),
      background: hasClass(section, "alt") ? "alt" : "default",
      items,
    }),
    anchor: section.attribs?.id || null,
  };
}

function recognizeTeam(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  if (!$(section).find(".team .person").length) return null;
  const people: Array<Record<string, unknown>> = [];
  $(section)
    .find(".person")
    .each((_, p) => {
      const $p = $(p);
      const img = $p.find("img").first();
      const links: Array<{ label: string; href: string; icon?: string }> = [];
      $p.find(".links a").each((_, a) => {
        const $a = $(a);
        const icon = $a.find("svg").first().toString() || undefined;
        const clone = $a.clone();
        clone.find("svg").remove();
        links.push({
          label: text(clone),
          href: $a.attr("href") || "#",
          icon,
        });
      });
      people.push({
        name: text($p.find("h3").first()),
        role: text($p.find(".role").first()),
        quote: text($p.find("q").first()),
        text: text($p.find("p.muted").first()) || text($p.find("p").first()),
        photo: img.attr("src") || "",
        photoAlt: img.attr("alt") || "",
        width: Number(img.attr("width")) || undefined,
        height: Number(img.attr("height")) || undefined,
        links: links.length ? links : undefined,
      });
    });
  return {
    type: "team",
    data: parseBlockData("team", {
      header: headerFrom($, section),
      background: hasClass(section, "alt") ? "alt" : "default",
      people,
    }),
    anchor: section.attribs?.id || "team",
  };
}

function recognizeCta(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  if (!$(section).find(".cta").length) return null;
  const $cta = $(section).find(".cta").first();
  const buttons: Array<{ label: string; href: string; style: "primary" | "secondary" }> =
    [];
  $cta.find(".acts a").each((_, a) => {
    const $a = $(a);
    const cls = $a.attr("class") || "";
    buttons.push({
      label: text($a),
      href: $a.attr("href") || "#",
      style: cls.includes("bt-btn2") ? "secondary" : "primary",
    });
  });
  let rings: unknown = null;
  const ringsAttr = $cta.find("[data-magic-rings]").attr("data-magic-rings");
  if (ringsAttr) {
    try {
      rings = JSON.parse(ringsAttr);
    } catch {
      rings = null;
    }
  }
  return {
    type: "cta",
    data: parseBlockData("cta", {
      title: text($cta.find("h2").first()) || "CTA",
      lead: text($cta.find(".lead").first()) || null,
      buttons,
      rings,
      background: hasClass(section, "alt") ? "alt" : "default",
    }),
    anchor: section.attribs?.id || null,
  };
}

function recognizeAnswer(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  if (!$(section).find(".answer").length) return null;
  // cards/grid рядом — не answer-only
  if ($(section).find(".grid .card").length > 2) return null;
  const answerHtml = $(section).find(".answer").html() || "";
  const facts: Array<{ value: string; label: string }> = [];
  $(section)
    .find(".fact")
    .each((_, f) => {
      const $f = $(f);
      facts.push({
        value: text($f.find("b").first()),
        label: text($f.find("span").first()),
      });
    });
  return {
    type: "answer",
    data: parseBlockData("answer", {
      header: headerFrom($, section),
      html: sanitizeCmsHtml(answerHtml),
      text:
        cheerio.load(`<div>${answerHtml}</div>`)("div").text().trim() ||
        text($(section).find(".answer")),
      facts,
    }),
    anchor: section.attribs?.id || null,
  };
}

function recognizeCases(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  const $cases = $(section).find(".card.case");
  if ($cases.length < 2) return null;
  // не путать с обычными карточками услуг
  if (!$cases.find("dl, picture, img[src*='case-']").length) return null;
  const items: Array<Record<string, unknown>> = [];
  $cases.each((_, c) => {
    const $c = $(c);
    const img = $c.find("img").first();
    const before = text($c.find("dl dt").filter((_, el) => text($(el)) === "Было").first().next("dd"));
    const $didDd = $c
      .find("dl dt")
      .filter((_, el) => text($(el)) === "Сделали")
      .first()
      .next("dd");
    const didHtml = $didDd.length ? sanitizeCmsHtml($didDd.html() || "") : null;
    const result = text(
      $c
        .find("dl dt")
        .filter((_, el) => text($(el)) === "Результат")
        .first()
        .next("dd"),
    );
    const $more = $c.find("a.more").first();
    items.push({
      title: text($c.find("h3").first()),
      tag: text($c.find(".kicker").first()) || null,
      before: before || null,
      didHtml: didHtml || null,
      result: result || null,
      image: img.attr("src") || null,
      imageAlt: img.attr("alt") || null,
      imageWidth: Number(img.attr("width")) || undefined,
      imageHeight: Number(img.attr("height")) || undefined,
      href: $more.attr("href") || ($c.is("a") ? $c.attr("href") : null) || null,
      more: $more.length ? text($more) : null,
    });
  });
  if (!items.length) return null;
  return {
    type: "cases",
    data: parseBlockData("cases", {
      header: headerFrom($, section),
      background: hasClass(section, "alt") ? "alt" : "default",
      variant: "portfolio",
      items,
    }),
    anchor: section.attribs?.id || null,
  };
}

function recognizeCards(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  const $grid = $(section).find(".grid").first();
  if (!$grid.length || !$grid.find(".card").length) return null;
  // кейсы портфолио — отдельный тип
  if ($grid.find(".card.case").length >= 2) return null;
  const cls = $grid.attr("class") || "";
  const columns = cls.includes("g4") ? 4 : cls.includes("g2") ? 2 : 3;
  const items: Array<Record<string, unknown>> = [];
  $grid.find("> .card, > a.card").each((_, c) => {
    const $c = $(c);
    const cardCls = $c.attr("class") || "";
    const linkHref = $c.is("a") ? $c.attr("href") : $c.find("a.more").attr("href");
    const $more = $c.find(".more").first();
    let linkLabel: string | null = null;
    if ($more.length) {
      const clone = $more.clone();
      clone.find("svg").remove();
      linkLabel = text(clone) || "Подробнее";
    } else if ($c.is("a")) {
      linkLabel = "Подробнее";
    }
    const checklist: string[] = [];
    $c.find("ul.chk li").each((_, li) => {
      checklist.push(text($(li)));
    });
    const cardStyle = cardCls.includes("dir-link")
      ? "dir-link"
      : cardCls.includes("vaybik-teaser")
        ? "teaser"
        : "default";
    items.push({
      num: text($c.find(".num").first()) || null,
      icon: $c.find(".ibox").html() || null,
      kicker: text($c.find(".kicker").first()) || null,
      title: text($c.find("h3").first()),
      text: text($c.find("p").first()) || null,
      price: text($c.find(".price").first()) || null,
      checklist: checklist.length ? checklist : undefined,
      link:
        linkHref && linkLabel
          ? { href: linkHref, label: linkLabel }
          : null,
      highlight: cardCls.includes("hl-card"),
      cardStyle,
      image: $c.find("img").first().attr("src") || null,
    });
  });
  // teaser часто после grid
  $(section)
    .find("> .w > a.card.vaybik-teaser, > a.card.vaybik-teaser")
    .each((_, c) => {
      const $c = $(c);
      const cloneMore = $c.find(".more").first().clone();
      cloneMore.find("svg").remove();
      items.push({
        num: null,
        icon: null,
        kicker: text($c.find(".kicker").first()) || null,
        title: text($c.find("h3").first()),
        text: text($c.find("p").first()) || null,
        price: null,
        link: {
          href: $c.attr("href") || "#",
          label: text(cloneMore) || "Подробнее",
        },
        highlight: false,
        cardStyle: "teaser",
        image: $c.find("img").first().attr("src") || null,
      });
    });
  if (!items.length) return null;
  return {
    type: "cards",
    data: parseBlockData("cards", {
      header: headerFrom($, section),
      background: hasClass(section, "alt") ? "alt" : "default",
      columns,
      items,
    }),
    anchor: section.attribs?.id || null,
  };
}

function recognizeWidget(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  const id = section.attribs?.id || "";
  if (id === "studio" || $(section).find("#studio-stage").length) {
    const clone = $(section).clone();
    clone.find("script").remove();
    return {
      type: "widget",
      data: parseBlockData("widget", {
        key: "studio",
        htmlSnapshot: sanitizeCmsHtml(clone.html() || ""),
      }),
      anchor: "studio",
    };
  }
  if ($(section).find("form.calc, .calc").length && !$(section).find(".lc-").length) {
    const clone = $(section).clone();
    clone.find("script").remove();
    // убрать onsubmit javascript handlers via sanitize
    return {
      type: "widget",
      data: parseBlockData("widget", {
        key: "calcMini",
        htmlSnapshot: sanitizeCmsHtml($.html(clone) || ""),
      }),
      anchor: section.attribs?.id || "calc-sec",
    };
  }
  if ($(section).find("[class*='lc-']").length || id.includes("kalk")) {
    const clone = $(section).clone();
    clone.find("script").remove();
    return {
      type: "widget",
      data: parseBlockData("widget", {
        key: "calcFull",
        htmlSnapshot: sanitizeCmsHtml($.html(clone) || ""),
      }),
      anchor: section.attribs?.id || null,
    };
  }
  return null;
}

export function recognizeSection(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock {
  const tryFns = [
    recognizeHero,
    recognizeWidget,
    recognizeFaq,
    recognizeSteps,
    recognizeTeam,
    recognizeCta,
    recognizeAnswer,
    recognizeCases,
    recognizeCards,
  ];  for (const fn of tryFns) {
    try {
      const r = fn($, section);
      if (r) return r;
    } catch {
      /* fall through to rawHtml */
    }
  }
  return {
    type: "rawHtml",
    data: parseBlockData("rawHtml", { html: sectionOuterHtml($, section) }),
    anchor: section.attribs?.id || null,
    reason: `не распознано: class="${section.attribs?.class || ""}" id="${section.attribs?.id || ""}"`,
  };
}

export function extractSeo($: cheerio.CheerioAPI) {
  const jsonLdRaw = $('script[type="application/ld+json"]').first().html();
  let jsonLd: unknown = null;
  if (jsonLdRaw) {
    try {
      jsonLd = JSON.parse(jsonLdRaw);
    } catch {
      jsonLd = null;
    }
  }
  return {
    title: $("title").first().text().trim() || null,
    description: $('meta[name="description"]').attr("content") || null,
    canonical: $('link[rel="canonical"]').attr("href") || null,
    robots: $('meta[name="robots"]').attr("content") || "index,follow",
    ogTitle: $('meta[property="og:title"]').attr("content") || null,
    ogDescription: $('meta[property="og:description"]').attr("content") || null,
    ogImage: $('meta[property="og:image"]').attr("content") || null,
    twitterCard: $('meta[name="twitter:card"]').attr("content") || null,
    jsonLd,
  };
}

export function extractMainBlocks(html: string): {
  blocks: RecognizedBlock[];
  seo: ReturnType<typeof extractSeo>;
  rawHtmlCount: number;
} {
  const $ = cheerio.load(html);
  const seo = extractSeo($);
  const blocks: RecognizedBlock[] = [];
  let rawHtmlCount = 0;
  $("main > section").each((_, section) => {
    const rec = recognizeSection($, section as Element);
    if (rec.type === "rawHtml") rawHtmlCount += 1;
    blocks.push(rec);
  });
  return { blocks, seo, rawHtmlCount };
}
