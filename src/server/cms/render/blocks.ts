import { sanitizeCmsHtml, sanitizeRichText } from "../sanitize";
import { esc, escAttr, simpleMarkdown } from "./escape";
import {
  renderMediaPicture,
  resolveMediaSrc,
  type MediaRenderContext,
} from "./media";
import { renderWidgetHtml } from "./widgets";

export type { MediaRenderContext };

function richOrMd(
  html: unknown,
  legacy: unknown,
  preset: "full" | "basic" | "inline",
): string {
  if (typeof html === "string" && html.trim()) {
    return sanitizeRichText(html, preset);
  }
  if (typeof legacy === "string" && legacy.trim()) {
    return simpleMarkdown(legacy);
  }
  return "";
}

export type RenderOptions = {
  mode?: "public" | "preview";
  media?: MediaRenderContext | null;
};

export type RenderBlock = {
  type: string;
  data: unknown;
  isHidden?: boolean;
  anchor?: string | null;
};

type Header = { kicker?: string | null; title?: string | null; subtitle?: string | null };

function secHeader(h?: Header | null): string {
  if (!h) return "";
  const parts: string[] = ['<div class="sec-h reveal">'];
  if (h.kicker) parts.push(`<span class="kicker">${esc(h.kicker)}</span>`);
  if (h.title) parts.push(`<h2>${esc(h.title)}</h2>`);
  if (h.subtitle) parts.push(`<p class="muted">${esc(h.subtitle)}</p>`);
  parts.push("</div>");
  return parts.join("");
}

function secOpen(anchor?: string | null, alt?: boolean): string {
  const cls = alt ? 'class="sec alt"' : 'class="sec"';
  const id = anchor ? ` id="${escAttr(anchor)}"` : "";
  return `<section ${cls}${id}><div class="w">`;
}

function secClose(): string {
  return "</div></section>";
}

function buttonsHtml(
  buttons: Array<{ label: string; href: string; style?: string }> = [],
): string {
  if (!buttons.length) return "";
  return `<div class="acts">${buttons
    .map((b) => {
      const cls = b.style === "secondary" ? "bt-btn2" : "bt-btn";
      const inner =
        b.style === "secondary"
          ? esc(b.label)
          : `<span class="bt-sl">${esc(b.label)}</span>`;
      return `<a class="${cls}" href="${escAttr(b.href)}">${inner}</a>`;
    })
    .join("")}</div>`;
}

function renderHero(data: Record<string, unknown>, anchor?: string | null): string {
  const variant = String(data.variant || "home");
  const heroClass =
    variant === "service"
      ? "hero svc-hero"
      : variant === "sub"
        ? "hero sub"
        : "hero hero-mascot";
  const id = anchor ? ` id="${escAttr(anchor)}"` : "";
  const accentRaw = data.titleAccent != null ? String(data.titleAccent).trim() : "";
  const titleRaw = data.title != null ? String(data.title).trim() : "";
  // Не дублировать: импорт часто кладёт один и тот же текст в accent и title
  const titleRest =
    accentRaw && titleRaw && titleRaw === accentRaw ? "" : titleRaw;
  const visualRaw =
    data.titleVisual != null
      ? String(data.titleVisual).trim()
      : "";
  const titleAccent = accentRaw
    ? `<span class="grad">${esc(accentRaw)}</span>`
    : "";
  // home: подзаголовок как .visually с тире (как в leadweb)
  let h1Inner: string;
  if (variant === "home" && accentRaw) {
    const visualText =
      visualRaw ||
      (titleRest
        ? titleRest.startsWith("—") || titleRest.startsWith("-")
          ? titleRest
          : `— ${titleRest}`
        : "");
    const titleVisual = visualText
      ? `<span class="visually" style="display:block;font-size:.42em;font-weight:600;margin-top:.4em">${esc(visualText)}</span>`
      : "";
    h1Inner = `${titleAccent}${titleVisual}`;
  } else {
    const titleVisual = visualRaw
      ? `<span class="visually" style="display:block;font-size:.42em;font-weight:600;margin-top:.4em">${esc(visualRaw)}</span>`
      : "";
    h1Inner = [titleAccent, titleRest ? esc(titleRest) : "", titleVisual]
      .filter(Boolean)
      .join(titleAccent && titleRest ? " " : "");
  }
  const rings = data.rings
    ? `<div class="rings" aria-hidden="true" data-magic-rings='${escAttr(JSON.stringify(data.rings))}'></div>`
    : "";
  const mascot = String(data.mascot || "privet");
  const feats = Array.isArray(data.feats)
    ? `<div class="feats">${(data.feats as Array<{ icon?: string; text: string }>)
        .map(
          (f) =>
            `<div class="feat">${f.icon || ""}<b>${esc(f.text)}</b></div>`,
        )
        .join("")}</div>`
    : "";

  return `<section class="${heroClass}"${id}>${rings}<div class="w"><div class="svc-hero-layout"><div class="svc-hero-copy">${
    data.kicker ? `<span class="kicker">${esc(String(data.kicker))}</span>` : ""
  }<h1>${h1Inner}</h1>${
    data.lead ? `<p class="lead">${esc(String(data.lead))}</p>` : ""
  }${buttonsHtml(data.buttons as never)}</div><figure class="mascot"><img src="/img/vaybik-${escAttr(mascot)}.png" alt="" width="400" height="539"></figure></div>${feats}</div></section>`;
}

function renderAnswer(data: Record<string, unknown>, anchor?: string | null): string {
  const facts = Array.isArray(data.facts)
    ? `<div class="facts reveal">${(data.facts as Array<{ value: string; label: string }>)
        .map((f) => `<div class="fact"><b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`)
        .join("")}</div>`
    : "";
  const body = richOrMd(data.html, data.text, "basic")
    .replace(/<p>/, '<div class="answer reveal"><p>')
    .replace(/<\/p>$/, "</p></div>");
  return `${secOpen(anchor)}${body}${facts ? `<div style="margin-top:40px">${facts}</div>` : ""}${secClose()}`;
}

function renderCards(data: Record<string, unknown>, anchor?: string | null): string {
  const cols = Number(data.columns) || 3;
  const items = (data.items as Array<Record<string, unknown>>) || [];
  const cards = items
    .map((it) => {
      const hl = it.highlight ? " hl-card" : "";
      const num = it.num ? `<span class="num">${esc(String(it.num))}</span>` : "";
      const icon = it.icon ? `<span class="ibox">${it.icon}</span>` : "";
      const price = it.price ? `<div class="price">${esc(String(it.price))}</div>` : "";
      const textHtml = richOrMd(it.textHtml, null, "inline");
      const text = textHtml
        ? `<p>${textHtml}</p>`
        : it.text
          ? `<p>${esc(String(it.text))}</p>`
          : "";
      const chk = Array.isArray(it.checklist)
        ? `<ul class="chk">${(it.checklist as string[]).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`
        : "";
      const link =
        it.link && typeof it.link === "object"
          ? `<a class="more" href="${escAttr(String((it.link as { href: string }).href))}">${esc(String((it.link as { label: string }).label))}</a>`
          : "";
      return `<article class="card reveal${hl}">${num}${icon}<h3>${esc(String(it.title || ""))}</h3>${price}${text}${chk}${link}</article>`;
    })
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<div class="grid g${cols}">${cards}</div>${secClose()}`;
}

function renderFaq(data: Record<string, unknown>, anchor?: string | null): string {
  const items =
    (data.items as Array<{
      question: string;
      answer?: string;
      answerHtml?: string;
    }>) || [];
  const details = items
    .map(
      (it) =>
        `<details><summary><span>${esc(it.question)}</span></summary><div>${richOrMd(it.answerHtml, it.answer, "basic")}</div></details>`,
    )
    .join("");
  return `${secOpen(anchor || "faq", data.background === "alt")}${secHeader(data.header as Header)}<div class="faq reveal">${details}</div>${secClose()}`;
}

function renderTeam(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions,
): string {
  const people = (data.people as Array<Record<string, unknown>>) || [];
  const html = people
    .map((p) => {
      const w = typeof p.width === "number" ? p.width : null;
      const h = typeof p.height === "number" ? p.height : null;
      let img = "";
      if (opts.media) {
        img = renderMediaPicture(p.photo, opts.media, {
          fallbackAlt: String(p.photoAlt || p.name || ""),
          lazy: true,
          width: w,
          height: h,
        });
      }
      if (!img) {
        const media = resolveMediaSrc(
          p.photo,
          opts.media ?? null,
          String(p.photoAlt || p.name || ""),
        );
        const wh =
          (w ? ` width="${w}"` : "") + (h ? ` height="${h}"` : "");
        img = media.src
          ? `<img src="${escAttr(media.src)}" alt="${escAttr(media.alt)}"${wh} loading="lazy">`
          : "";
      }
      const bio =
        typeof p.textHtml === "string" && p.textHtml
          ? richOrMd(p.textHtml, null, "inline")
          : esc(String(p.text || ""));
      return `<article class="person reveal">${img}<div><h3>${esc(String(p.name || ""))}</h3><div class="role">${esc(String(p.role || ""))}</div>${p.quote ? `<q>${esc(String(p.quote))}</q>` : ""}<p class="muted">${bio}</p></div></article>`;
    })
    .join("");
  return `${secOpen(anchor || "team", data.background === "alt")}${secHeader(data.header as Header)}<div class="team">${html}</div>${secClose()}`;
}

function renderCases(data: Record<string, unknown>, anchor?: string | null): string {
  const items = (data.items as Array<Record<string, string>>) || [];
  const cards = items
    .map((it) => {
      const caseText =
        it.textHtml && String(it.textHtml).trim()
          ? richOrMd(it.textHtml, null, "inline")
          : esc(it.text || "");
      const inner = `${it.tag ? `<span class="kicker">${esc(it.tag)}</span>` : ""}<h3>${esc(it.title || "")}</h3><p>${caseText}</p>${it.result ? `<p><em>${esc(it.result)}</em></p>` : ""}`;
      if (it.href) {
        return `<a class="card case reveal" href="${escAttr(it.href)}">${inner}</a>`;
      }
      return `<article class="card case reveal">${inner}</article>`;
    })
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<div class="grid g3">${cards}</div>${secClose()}`;
}

function renderCta(data: Record<string, unknown>, anchor?: string | null): string {
  const rings = data.rings
    ? `<div class="sec-rings" aria-hidden="true" data-magic-rings='${escAttr(JSON.stringify(data.rings))}'></div>`
    : "";
  return `${secOpen(anchor, data.background === "alt")}<div class="cta reveal">${rings}<div class="w2"><h2>${esc(String(data.title || ""))}</h2>${
    data.lead ? `<p class="lead">${esc(String(data.lead))}</p>` : ""
  }${buttonsHtml(data.buttons as never)}</div></div>${secClose()}`;
}

function renderText(data: Record<string, unknown>, anchor?: string | null): string {
  const body = richOrMd(data.html, data.markdown, "full");
  const wrap =
    data.layout === "two"
      ? `<div class="grid g2 reveal">${body}</div>`
      : `<div class="reveal">${body}</div>`;
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}${wrap}${secClose()}`;
}

function renderWidget(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions,
): string {
  return renderWidgetHtml(data, opts.mode || "preview", anchor);
}

function renderRawHtml(data: Record<string, unknown>, anchor?: string | null): string {
  const html = sanitizeCmsHtml(String(data.html || ""));
  if (html.trim().startsWith("<section")) return html;
  const id = anchor ? ` id="${escAttr(anchor)}"` : "";
  return `<section class="sec"${id}>${html}</section>`;
}

function renderIconList(data: Record<string, unknown>, anchor?: string | null): string {
  const variant = String(data.variant || "plist-cards");
  const items = (data.items as Array<Record<string, unknown>>) || [];
  if (variant === "safe") {
    const lis = items
      .map((it) => {
        const body = richOrMd(it.textHtml, it.text, "inline");
        return `<li><span class="ibox">${it.icon || ""}</span><div><h3>${esc(String(it.title || ""))}</h3><p>${body}</p></div></li>`;
      })
      .join("");
    return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<ul class="safe reveal">${lis}</ul>${secClose()}`;
  }
  const lis = items
    .map((it) => {
      const body = richOrMd(it.textHtml, it.text, "inline");
      return `<li><span class="ibox">${it.icon || ""}</span><span>${body || esc(String(it.title || ""))}</span></li>`;
    })
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<ul class="plist-cards reveal">${lis}</ul>${secClose()}`;
}

function renderOffer(data: Record<string, unknown>, anchor?: string | null): string {
  const items = (data.items as Array<Record<string, unknown>>) || [];
  const cards = items
    .map((it) => {
      const hl = it.highlight ? " hl-box" : "";
      return `<article class="answer reveal${hl}">${
        it.kicker ? `<span class="kicker">${esc(String(it.kicker))}</span>` : ""
      }${richOrMd(it.html, null, "basic")}${
        it.price ? `<div class="price">${esc(String(it.price))}</div>` : ""
      }</article>`;
    })
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<div class="grid g2">${cards}</div>${secClose()}`;
}

function renderBeforeAfter(
  data: Record<string, unknown>,
  anchor?: string | null,
): string {
  const items = (data.items as Array<{ before: string; after: string }>) || [];
  const lis = items
    .map(
      (it) =>
        `<li><span class="ba-before">${esc(it.before)}</span><span class="ba-after">${esc(it.after)}</span></li>`,
    )
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<ul class="ba-list reveal">${lis}</ul>${secClose()}`;
}

function renderSteps(data: Record<string, unknown>, anchor?: string | null): string {
  const variant = String(data.variant || "default");
  const items =
    (data.items as Array<{
      title: string;
      text: string;
      result: string;
      icon?: string;
    }>) || [];
  if (variant === "flow5") {
    const lis = items
      .map(
        (it, i) =>
          `<li><span class="num">${i + 1}</span>${it.icon ? `<span class="ibox">${it.icon}</span>` : ""}<b>${esc(it.title)}</b><span>${esc(it.text)}</span><em>${esc(it.result)}</em></li>`,
      )
      .join("");
    return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<ol class="flow5 reveal">${lis}</ol>${secClose()}`;
  }
  if (variant === "av" || variant === "k-steps") {
    const cls = variant === "av" ? "steps av-steps" : "steps k-steps";
    const lis = items
      .map(
        (it) =>
          `<li>${it.icon ? `<span class="ibox">${it.icon}</span>` : ""}<b>${esc(it.title)}</b><span>${esc(it.text)}</span><em>${esc(it.result)}</em></li>`,
      )
      .join("");
    return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<ol class="${cls} reveal">${lis}</ol>${secClose()}`;
  }
  const lis = items
    .map(
      (it) =>
        `<li><b>${esc(it.title)}</b><span>${esc(it.text)}</span><em>${esc(it.result)}</em></li>`,
    )
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<ol class="steps reveal">${lis}</ol>${secClose()}`;
}

export function renderBlock(
  block: RenderBlock,
  opts: RenderOptions = {},
): string {
  if (block.isHidden) return "";
  const data = (block.data || {}) as Record<string, unknown>;
  switch (block.type) {
    case "hero":
      return renderHero(data, block.anchor);
    case "answer":
      return renderAnswer(data, block.anchor);
    case "cards":
      return renderCards(data, block.anchor);
    case "steps":
      return renderSteps(data, block.anchor);
    case "faq":
      return renderFaq(data, block.anchor);
    case "team":
      return renderTeam(data, block.anchor, opts);
    case "cases":
      return renderCases(data, block.anchor);
    case "cta":
      return renderCta(data, block.anchor);
    case "text":
      return renderText(data, block.anchor);
    case "widget":
      return renderWidget(data, block.anchor, opts);
    case "iconList":
      return renderIconList(data, block.anchor);
    case "offer":
      return renderOffer(data, block.anchor);
    case "beforeAfter":
      return renderBeforeAfter(data, block.anchor);
    case "rawHtml":
      return renderRawHtml(data, block.anchor);
    default:
      return `<!-- unknown block ${esc(block.type)} -->`;
  }
}

export function renderBlocks(
  blocks: RenderBlock[],
  opts: RenderOptions = {},
): string {
  return blocks.map((b) => renderBlock(b, opts)).join("\n");
}
