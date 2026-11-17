import * as cheerio from "cheerio";
import { parseBlockData } from "./blocks";
import { renderBlock } from "./render/blocks";
import { sanitizeRichText } from "./sanitize";

export type ConvertResult =
  | {
      ok: true;
      type: string;
      data: unknown;
    }
  | { ok: false; reason: string };

function normText(html: string): string {
  return cheerio
    .load(html)("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function countLinks(html: string): number {
  return cheerio.load(html)("a[href]").length;
}

function countImgs(html: string): number {
  return cheerio.load(html)("img").length;
}

function header($: cheerio.CheerioAPI) {
  const h = $(".sec-h").first();
  if (!h.length) return null;
  return {
    kicker: h.find(".kicker").first().text().trim() || null,
    title: h.find("h2").first().text().trim() || null,
    subtitle: h.find(".muted").first().text().trim() || null,
  };
}

function tryConvert($: cheerio.CheerioAPI): ConvertResult {
  const alt = ($("section").first().attr("class") || "").includes("alt")
    ? "alt"
    : "default";

  if ($(".ba-list").length) {
    const items: Array<{ before: string; after: string }> = [];
    $(".ba-list li").each((_, li) => {
      const $li = $(li);
      items.push({
        before: $li.find(".ba-before").text().trim() || $li.children().eq(0).text().trim(),
        after: $li.find(".ba-after").text().trim() || $li.children().eq(1).text().trim(),
      });
    });
    if (items.length) {
      return {
        ok: true,
        type: "beforeAfter",
        data: parseBlockData("beforeAfter", {
          header: header($),
          background: alt,
          items,
        }),
      };
    }
  }

  if ($("ul.safe").length) {
    const items: Array<Record<string, unknown>> = [];
    $("ul.safe > li").each((_, li) => {
      const $li = $(li);
      items.push({
        icon: $li.find(".ibox").html() || "",
        title: $li.find("h3").text().trim() || null,
        textHtml: sanitizeRichText($li.find("p").html() || $li.text(), "inline"),
      });
    });
    return {
      ok: true,
      type: "iconList",
      data: parseBlockData("iconList", {
        header: header($),
        background: alt,
        variant: "safe",
        items,
      }),
    };
  }

  if ($("ul.plist-cards").length) {
    const items: Array<Record<string, unknown>> = [];
    $("ul.plist-cards > li").each((_, li) => {
      const $li = $(li);
      items.push({
        icon: $li.find(".ibox").html() || "",
        title: null,
        textHtml: sanitizeRichText(
          $li.find("span").not(".ibox").html() || $li.text(),
          "inline",
        ),
      });
    });
    return {
      ok: true,
      type: "iconList",
      data: parseBlockData("iconList", {
        header: header($),
        background: alt,
        variant: "plist-cards",
        items,
      }),
    };
  }

  if ($("ol.flow5").length || $("ol.av-steps").length || $("ol.k-steps").length) {
    const variant = $("ol.flow5").length
      ? "flow5"
      : $("ol.av-steps").length
        ? "av"
        : "k-steps";
    const sel =
      variant === "flow5"
        ? "ol.flow5 > li"
        : variant === "av"
          ? "ol.av-steps > li"
          : "ol.k-steps > li";
    const items: Array<Record<string, unknown>> = [];
    $(sel).each((_, li) => {
      const $li = $(li);
      items.push({
        title: $li.find("b,h3").first().text().trim() || $li.text().trim(),
        text: $li.find("span").not(".ibox,.num").first().text().trim() || "",
        result: $li.find("em").text().trim() || "",
        icon: $li.find(".ibox").html() || null,
      });
    });
    return {
      ok: true,
      type: "steps",
      data: parseBlockData("steps", {
        header: header($),
        background: alt,
        variant,
        items,
      }),
    };
  }

  // portfolio cases
  if ($("a.card.case, .card.case").length >= 2) {
    const items: Array<Record<string, unknown>> = [];
    $("a.card.case, article.card.case, .card.case").each((_, c) => {
      const $c = $(c);
      items.push({
        title: $c.find("h3").text().trim(),
        tag: $c.find(".kicker").text().trim() || null,
        textHtml: sanitizeRichText($c.find("p").first().html() || "", "inline"),
        href: $c.is("a") ? $c.attr("href") || null : $c.find("a").attr("href") || null,
        image: $c.find("img").attr("src") || null,
      });
    });
    if (items.length) {
      return {
        ok: true,
        type: "cases",
        data: parseBlockData("cases", {
          header: header($),
          background: alt,
          variant: "portfolio",
          items,
        }),
      };
    }
  }

  // offer / answer cards in g2
  if ($(".grid.g2 .answer, .grid.g2 .hl-box").length >= 1) {
    const items: Array<Record<string, unknown>> = [];
    $(".grid.g2 > *").each((_, el) => {
      const $el = $(el);
      items.push({
        kicker: $el.find(".kicker").text().trim() || null,
        html: sanitizeRichText(
          $el.find("p,div").not(".price").first().html() || $el.html() || "",
          "basic",
        ),
        price: $el.find(".price").text().trim() || null,
        highlight: ($el.attr("class") || "").includes("hl"),
      });
    });
    if (items.length) {
      return {
        ok: true,
        type: "offer",
        data: parseBlockData("offer", {
          header: header($),
          background: alt,
          items,
        }),
      };
    }
  }

  // text two-col «Что входит»
  if ($("h2").text().includes("Что входит") || $(".grid.g2 ul.lead").length) {
    const html = sanitizeRichText($(".w").html() || $("section").html() || "", "full");
    return {
      ok: true,
      type: "text",
      data: parseBlockData("text", {
        header: header($),
        background: alt,
        layout: "two",
        html,
      }),
    };
  }

  return { ok: false, reason: "нет подходящего распознавателя" };
}

/** Конвертация HTML rawHtml-блока в типизированный блок без потерь текста */
export function convertRawHtmlBlock(html: string): ConvertResult {
  const $ = cheerio.load(html);
  // keysy cases — огромные диалоги
  if ($(".k-case, .k-do-block").length) {
    return { ok: false, reason: "keysy dialogs — оставить rawHtml (часть 4)" };
  }
  const converted = tryConvert($);
  if (!converted.ok) return converted;

  const rendered = renderBlock({
    type: converted.type,
    data: converted.data,
    isHidden: false,
    anchor: null,
  });
  const srcText = normText(html);
  const outText = normText(rendered);
  if (srcText !== outText) {
    // допускаем небольшую разницу пробелов уже нормализованную — если всё ещё нет
    const ratio =
      Math.min(srcText.length, outText.length) /
      Math.max(srcText.length, outText.length || 1);
    if (ratio < 0.92 || Math.abs(srcText.length - outText.length) > 80) {
      return {
        ok: false,
        reason: `потеря текста (src ${srcText.length} vs out ${outText.length})`,
      };
    }
  }
  if (countLinks(html) !== countLinks(rendered)) {
    return {
      ok: false,
      reason: `число ссылок: ${countLinks(html)} → ${countLinks(rendered)}`,
    };
  }
  if (countImgs(html) !== countImgs(rendered)) {
    return {
      ok: false,
      reason: `число картинок: ${countImgs(html)} → ${countImgs(rendered)}`,
    };
  }
  return converted;
}
