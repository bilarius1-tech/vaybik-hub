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
  // av-hero сам по себе не svc-hero (/avtomatizaciya/ = home+avHero)
  const variant = hasClass(section, "svc-hero")
    ? "service"
    : hasClass(section, "sub")
      ? "sub"
      : "home";
  const h1 = $s.find("h1").first();
  const accent = text(h1.find(".grad").first());
  // подзаголовок блоком (class=visually или display:block)
  const $visual = h1
    .find("span")
    .filter((_, el) => {
      const $el = $(el);
      if ($el.hasClass("grad")) return false;
      if ($el.hasClass("visually")) return true;
      const style = ($el.attr("style") || "").replace(/\s+/g, "");
      return /display:block/i.test(style);
    })
    .first();
  const titleVisual = $visual.length ? text($visual) : null;
  const titleFull = text(h1);
  let title = accent
    ? titleFull.replace(accent, "").replace(/^\s+/, "").trim() || titleFull
    : titleFull;
  if (titleVisual) {
    // не дублировать visual в title (тире/дефис в начале title оставляем — это часть текста)
    title = title.replace(titleVisual, "").replace(/^\s+/, "").trim();
  }
  if (!title && accent) title = accent;
  // keysy: сохраняем <br> и .k-h1-rest как в leadweb
  const titleHtml = hasClass(section, "keysy-hero")
    ? sanitizeCmsHtml(h1.html() || "")
    : null;
  const buttons: Array<{
    label: string;
    href: string;
    style: "primary" | "secondary";
    icon?: string;
    className?: string;
  }> = [];
  $s.find(".acts a").each((_, a) => {
    const $a = $(a);
    const cls = $a.attr("class") || "";
    const icon = $a.find("svg").first().toString() || undefined;
    const clone = $a.clone();
    clone.find("svg").remove();
    const extras = cls
      .split(/\s+/)
      .filter((c) => c && c !== "bt-btn" && c !== "bt-btn2")
      .join(" ");
    buttons.push({
      label: text(clone) || text($a),
      href: $a.attr("href") || "#",
      style: cls.includes("bt-btn2") ? "secondary" : "primary",
      icon,
      className: extras || undefined,
    });
  });
  const feats: Array<{ icon?: string; title?: string; text: string }> = [];
  $s.find(".feat").each((_, f) => {
    const $f = $(f);
    const icon = $f.find("svg").first().toString() || undefined;
    const featTitle = text($f.find("b").first());
    const desc = text($f.find("span").first());
    if (featTitle && desc) {
      feats.push({ icon, title: featTitle, text: desc });
    } else {
      feats.push({ icon, text: featTitle || desc || text($f) });
    }
  });
  // сырые строки — сохраняют порядок ключей leadweb для DOM-parity
  const ringsAttr = $s.find("[data-magic-rings]").attr("data-magic-rings");
  const rings = ringsAttr?.trim() || null;
  const blindsAttr = $s
    .find("[data-gradient-blinds]")
    .attr("data-gradient-blinds");
  const gradientBlinds = blindsAttr?.trim() || null;
  const $svcSub = $s.find("ul.svc-sub").first();
  const svcSubHtml = $svcSub.length
    ? sanitizeCmsHtml($.html($svcSub) || "")
    : null;
  const $brand = $s.find(".brand-lockup").first();
  const brandHtml = $brand.length
    ? sanitizeCmsHtml($.html($brand) || "")
    : null;
  const notes: string[] = [];
  $s.find(".svc-note").each((_, n) => {
    const t = text($(n));
    if (t) notes.push(t);
  });
  const mascotSrc =
    $s.find("figure.mascot img").first().attr("src") ||
    $s.find(".mascot img").first().attr("src") ||
    "";
  const mascotMatch = mascotSrc.match(/vaybik-([a-z0-9-]+)\./i);
  const mascot = mascotMatch?.[1] || "privet";
  const data = parseBlockData("hero", {
    variant,
    avHero: hasClass(section, "av-hero"),
    keysyHero: hasClass(section, "keysy-hero"),
    kicker: text($s.find(".kicker").first()) || null,
    title: title || "Без названия",
    titleAccent: accent || null,
    titleVisual,
    titleHtml,
    lead: text($s.find(".lead").first()) || null,
    buttons,
    svcSubHtml,
    brandHtml,
    notes,
    mascot,
    feats,
    rings,
    gradientBlinds,
  });
  return { type: "hero", data, anchor: section.attribs?.id || null };
}

function recognizeFaq(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  if (!$(section).find(".faq").length) return null;
  const items: Array<{
    question: string;
    answer: string;
    icon?: string;
  }> = [];
  $(section)
    .find(".faq details")
    .each((_, d) => {
      const $d = $(d);
      const icon = $d.find("summary svg").first().toString() || undefined;
      items.push({
        question:
          text($d.find("summary span").first()) || text($d.find("summary")),
        answer: $d.find("div").first().text().trim() || text($d.find("div")),
        icon,
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
  const $ol = $(section).find("ol.steps").first();
  if (!$ol.length) return null;
  const olCls = $ol.attr("class") || "";
  const variant = olCls.includes("av-steps")
    ? "av"
    : olCls.includes("k-steps")
      ? "k-steps"
      : olCls.includes("flow5")
        ? "flow5"
        : "default";
  const items: Array<{
    title: string;
    text: string;
    result: string;
    icon?: string;
  }> = [];
  $ol.find("> li").each((_, li) => {
    const $li = $(li);
    const icon = $li.find(".ibox").first().html() || undefined;
    items.push({
      title: text($li.find("b").first()),
      // не брать .ibox (там только svg)
      text: text($li.find("> span").not(".ibox").first()) || text($li.find("span").not(".ibox").first()),
      result: text($li.find("em").first()),
      icon,
    });
  });
  return {
    type: "steps",
    data: parseBlockData("steps", {
      header: headerFrom($, section),
      background: hasClass(section, "alt") ? "alt" : "default",
      variant,
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

function recognizeOffer(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  const $grid = $(section).find(".grid.g2").first();
  if (!$grid.length) return null;
  if (!$grid.find("> .answer, > .hl-box, > .answer.hl-box").length) return null;
  // обычные карточки услуг — не offer
  if ($grid.find("> .card").length) return null;
  const items: Array<Record<string, unknown>> = [];
  $grid.find("> .answer, > .hl-box, > div.answer").each((_, el) => {
    const $el = $(el);
    const $price = $el.find(".price").first();
    const priceHtml = $price.length ? $price.html() : null;
    const priceStyle = $price.attr("style") || null;
    const clone = $el.clone();
    clone.find(".kicker, .price").remove();
    items.push({
      kicker: text($el.find(".kicker").first()) || null,
      html: sanitizeCmsHtml(clone.html() || ""),
      price: priceHtml ? sanitizeCmsHtml(priceHtml) : null,
      priceStyle,
      highlight: ($el.attr("class") || "").includes("hl"),
    });
  });
  if (items.length < 1) return null;
  return {
    type: "offer",
    data: parseBlockData("offer", {
      header: headerFrom($, section),
      background: hasClass(section, "alt") ? "alt" : "default",
      items,
    }),
    anchor: section.attribs?.id || null,
  };
}

function recognizeAnswer(
  $: cheerio.CheerioAPI,
  section: Element,
): RecognizedBlock | null {
  if (!$(section).find(".answer").length) return null;
  // offer g2 — отдельный тип
  if ($(section).find(".grid.g2 > .answer, .grid.g2 > .hl-box").length >= 1) {
    return null;
  }
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
  if (!$cases.length) return null;
  // не путать с обычными карточками услуг: нужен dl/картинка кейса
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
  // кейсы — отдельный тип (даже один)
  if ($grid.find(".card.case").length >= 1 && $grid.find(".card.case dl, .card.case picture").length) {
    return null;
  }
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
    const $ps = $c.find("p");
    const firstText = text($ps.first()) || null;
    let textHtml: string | null = null;
    if ($ps.length > 1 || $c.find("p.deliver").length) {
      const parts: string[] = [];
      $ps.each((_, p) => {
        const html = $(p).html() || "";
        if (html.trim()) parts.push(`<p>${html}</p>`);
      });
      textHtml = parts.length ? sanitizeCmsHtml(parts.join("")) : null;
    }
    items.push({
      num: text($c.find(".num").first()) || null,
      icon: $c.find(".ibox").html() || null,
      kicker: text($c.find(".kicker").first()) || null,
      title: text($c.find("h3").first()),
      text: firstText,
      textHtml,
      price: text($c.find(".price").first()) || null,
      checklist: checklist.length ? checklist : undefined,
      link:
        linkHref && linkLabel
          ? { href: linkHref, label: linkLabel }
          : null,
      highlight: cardCls.includes("hl-card"),
      cardStyle,
      image: $c.find("img").first().attr("src") || null,
    });  });
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
  // HTML между sec-h и сеткой + хвост после сетки — не терять
  const $w = $(section).find("> .w").first().length
    ? $(section).find("> .w").first()
    : $(section);
  const beforeParts: string[] = [];
  const afterParts: string[] = [];
  let seenHeader = false;
  let afterGrid = false;
  $w.contents().each((_, node) => {
    if (node.type !== "tag") return;
    const cls = (node as Element).attribs?.class || "";
    if (/\bsec-h\b/.test(cls)) {
      seenHeader = true;
      return;
    }
    if (/\bgrid\b/.test(cls)) {
      afterGrid = true;
      return;
    }
    if (afterGrid) {
      afterParts.push($.html(node) || "");
      return;
    }
    if (seenHeader) {
      beforeParts.push($.html(node) || "");
    }
  });
  const beforeHtml = beforeParts.join("").trim()
    ? sanitizeCmsHtml(beforeParts.join(""))
    : null;
  const afterHtml = afterParts.join("").trim()
    ? sanitizeCmsHtml(afterParts.join(""))
    : null;
  return {
    type: "cards",
    data: parseBlockData("cards", {
      header: headerFrom($, section),
      background: hasClass(section, "alt") ? "alt" : "default",
      columns,
      items,
      beforeHtml,
      afterHtml,
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
    const raw = $.html(clone) || "";
    // убрать onsubmit javascript handlers via sanitize
    return {
      type: "widget",
      data: parseBlockData("widget", {
        key: "calcMini",
        htmlSnapshot: sanitizeCmsHtml(raw),
        showMore: /calc-more/.test(raw),
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
    recognizeOffer,
    recognizeAnswer,
    recognizeCases,
    recognizeCards,
  ];
  for (const fn of tryFns) {
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
