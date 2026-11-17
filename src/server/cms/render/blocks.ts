import { sanitizeCmsHtml } from "../sanitize";
import { esc, escAttr, simpleMarkdown } from "./escape";

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
  const titleAccent = data.titleAccent
    ? `<span class="grad">${esc(String(data.titleAccent))}</span>`
    : "";
  const titleRest = esc(String(data.title || ""));
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
  }<h1>${titleAccent}${titleAccent ? " " : ""}${titleRest}</h1>${
    data.lead ? `<p class="lead">${esc(String(data.lead))}</p>` : ""
  }${buttonsHtml(data.buttons as never)}</div><figure class="mascot"><img src="/img/vaybik-${escAttr(mascot)}.png" alt="" width="400" height="539"></figure></div>${feats}</div></section>`;
}

function renderAnswer(data: Record<string, unknown>, anchor?: string | null): string {
  const facts = Array.isArray(data.facts)
    ? `<div class="facts reveal">${(data.facts as Array<{ value: string; label: string }>)
        .map((f) => `<div class="fact"><b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`)
        .join("")}</div>`
    : "";
  return `${secOpen(anchor)}${simpleMarkdown(String(data.text || "")).replace(/<p>/, '<div class="answer reveal"><p>').replace(/<\/p>$/, "</p></div>")}${facts ? `<div style="margin-top:40px">${facts}</div>` : ""}${secClose()}`;
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
      const text = it.text ? `<p>${esc(String(it.text))}</p>` : "";
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

function renderSteps(data: Record<string, unknown>, anchor?: string | null): string {
  const items = (data.items as Array<{ title: string; text: string; result: string }>) || [];
  const lis = items
    .map(
      (it) =>
        `<li><b>${esc(it.title)}</b><span>${esc(it.text)}</span><em>${esc(it.result)}</em></li>`,
    )
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<ol class="steps reveal">${lis}</ol>${secClose()}`;
}

function renderFaq(data: Record<string, unknown>, anchor?: string | null): string {
  const items = (data.items as Array<{ question: string; answer: string }>) || [];
  const details = items
    .map(
      (it) =>
        `<details><summary><span>${esc(it.question)}</span></summary><div>${simpleMarkdown(it.answer)}</div></details>`,
    )
    .join("");
  return `${secOpen(anchor || "faq", data.background === "alt")}${secHeader(data.header as Header)}<div class="faq reveal">${details}</div>${secClose()}`;
}

function renderTeam(data: Record<string, unknown>, anchor?: string | null): string {
  const people = (data.people as Array<Record<string, string | number>>) || [];
  const html = people
    .map((p) => {
      const w = p.width ? ` width="${p.width}"` : "";
      const h = p.height ? ` height="${p.height}"` : "";
      return `<article class="person reveal"><img src="${escAttr(String(p.photo || ""))}" alt="${escAttr(String(p.photoAlt || p.name || ""))}"${w}${h} loading="lazy"><div><h3>${esc(String(p.name || ""))}</h3><div class="role">${esc(String(p.role || ""))}</div>${p.quote ? `<q>${esc(String(p.quote))}</q>` : ""}<p class="muted">${esc(String(p.text || ""))}</p></div></article>`;
    })
    .join("");
  return `${secOpen(anchor || "team", data.background === "alt")}${secHeader(data.header as Header)}<div class="team">${html}</div>${secClose()}`;
}

function renderCases(data: Record<string, unknown>, anchor?: string | null): string {
  const items = (data.items as Array<Record<string, string>>) || [];
  const cards = items
    .map((it) => {
      const inner = `${it.tag ? `<span class="kicker">${esc(it.tag)}</span>` : ""}<h3>${esc(it.title || "")}</h3><p>${esc(it.text || "")}</p>${it.result ? `<p><em>${esc(it.result)}</em></p>` : ""}`;
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
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header)}<div class="reveal">${simpleMarkdown(String(data.markdown || ""))}</div>${secClose()}`;
}

function renderWidget(data: Record<string, unknown>, anchor?: string | null): string {
  const key = String(data.key || "studio");
  const snap = sanitizeCmsHtml(String(data.htmlSnapshot || ""));
  return `${secOpen(anchor || (key === "studio" ? "studio" : "calc-sec"))}<div class="widget widget-${escAttr(key)}">${snap || `<p class="muted">Виджет «${esc(key)}» (снимок пуст)</p>`}</div>${secClose()}`;
}

function renderRawHtml(data: Record<string, unknown>, anchor?: string | null): string {
  const html = sanitizeCmsHtml(String(data.html || ""));
  if (html.trim().startsWith("<section")) return html;
  const id = anchor ? ` id="${escAttr(anchor)}"` : "";
  return `<section class="sec"${id}>${html}</section>`;
}

export function renderBlock(block: RenderBlock): string {
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
      return renderTeam(data, block.anchor);
    case "cases":
      return renderCases(data, block.anchor);
    case "cta":
      return renderCta(data, block.anchor);
    case "text":
      return renderText(data, block.anchor);
    case "widget":
      return renderWidget(data, block.anchor);
    case "rawHtml":
      return renderRawHtml(data, block.anchor);
    default:
      return `<!-- unknown block ${esc(block.type)} -->`;
  }
}

export function renderBlocks(blocks: RenderBlock[]): string {
  return blocks.map(renderBlock).join("\n");
}
