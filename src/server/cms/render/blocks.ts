import { sanitizeCmsHtml, sanitizeRichText } from "../sanitize";
import { esc, escAttr, escJsonAttr, simpleMarkdown } from "./escape";
import {
  CHECK_ICON,
  EXT_MORE_ICON,
  FAQ_CHEV,
  FAQ_ICON,
  MORE_ARROW,
  PRICE_ICON,
  fixMissingSvgViewBox,
  MASCOT_META,
  renderMascotPicture,
} from "./leadweb-icons";
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
  path?: string;
  pageTitle?: string;
  template?: string;
  nav?: Array<{ label: string; url?: string | null; pagePath?: string | null }>;
};

/** leadweb: на body.svc у sec-h/card нет класса reveal */
function wantsReveal(opts: RenderOptions): boolean {
  const t = opts.template || "";
  return t !== "service" && t !== "keysy";
}

export type RenderBlock = {
  type: string;
  data: unknown;
  isHidden?: boolean;
  anchor?: string | null;
};

type Header = { kicker?: string | null; title?: string | null; subtitle?: string | null };

function secHeader(h?: Header | null, opts: RenderOptions = {}): string {
  if (!h) return "";
  const cls = wantsReveal(opts) ? "sec-h reveal" : "sec-h";
  const parts: string[] = [`<div class="${cls}">`];
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

/** Статичные /img/* → picture с webp (кейсы и маскоты leadweb). */
function renderStaticImgPicture(
  src: string,
  alt: string,
  opts?: {
    width?: number | null;
    height?: number | null;
    sizes?: string;
  },
): string {
  const w = opts?.width || null;
  const h = opts?.height || null;
  const wh = (w ? ` width="${w}"` : "") + (h ? ` height="${h}"` : "");
  const mascot = src.match(/\/img\/vaybik-([a-z0-9-]+)\.(png|webp|jpe?g)$/i);
  if (mascot) {
    const key = mascot[1]!;
    const meta = MASCOT_META[key];
    const srcset = meta?.srcset || `/img/vaybik-${key}-240.webp 240w, /img/vaybik-${key}-400.webp 400w, /img/vaybik-${key}-640.webp 640w`;
    const sizes = opts?.sizes || "132px";
    const mw = w || meta?.width || null;
    const mh = h || meta?.height || null;
    const mwh = (mw ? ` width="${mw}"` : "") + (mh ? ` height="${mh}"` : "");
    return `<picture><source type="image/webp" srcset="${escAttr(srcset)}" sizes="${escAttr(sizes)}"><img src="${escAttr(src)}" alt="${escAttr(alt)}"${mwh} loading="lazy"></picture>`;
  }
  const m = src.match(/^(\/img\/.+)\.(jpe?g|png)$/i);
  if (!m) {
    return `<img src="${escAttr(src)}" alt="${escAttr(alt)}"${wh} loading="lazy" decoding="async">`;
  }
  const base = m[1]!;
  const fullW = w || 782;
  const srcset = `${base}-400.webp 400w, ${base}-${fullW}.webp ${fullW}w`;
  const sizes = opts?.sizes || "260px";
  return `<picture><source type="image/webp" srcset="${escAttr(srcset)}" sizes="${escAttr(sizes)}"><img src="${escAttr(src)}" alt="${escAttr(alt)}"${wh} loading="lazy"></picture>`;
}

function buttonsHtml(
  buttons: Array<{
    label: string;
    href: string;
    style?: string;
    icon?: string | null;
    className?: string | null;
  }> = [],
): string {
  if (!buttons.length) return "";
  return `<div class="acts">${buttons
    .map((b) => {
      const isSecondary = b.style === "secondary";
      const base = isSecondary ? "bt-btn2" : "bt-btn";
      const extras = String(b.className || "")
        .split(/\s+/)
        .filter((c) => c && c !== base && c !== "bt-btn" && c !== "bt-btn2");
      // leadweb: tel: → bt-call (даже без className в данных)
      if (!isSecondary && /^tel:/i.test(b.href) && !extras.includes("bt-call")) {
        extras.push("bt-call");
      }
      // leadweb: «bt-btn bt-call » с хвостовым пробелом
      const cls = extras.length ? `${base} ${extras.join(" ")} ` : base;
      const icon = b.icon ? fixMissingSvgViewBox(String(b.icon)) : "";
      const inner = isSecondary
        ? `${icon}${esc(b.label)}`
        : `<span class="bt-sl">${icon}${esc(b.label)}</span>`;
      return `<a class="${cls}" href="${escAttr(b.href)}">${inner}</a>`;
    })
    .join("")}</div>`;
}

function renderCrumbs(opts: RenderOptions): string {
  const path = opts.path || "/";
  if (path === "/") return "";
  const segs = path.split("/").filter(Boolean);
  if (!segs.length) return "";
  const nav = opts.nav || [];
  const labelFor = (p: string, fallback: string, isLast: boolean) => {
    const hit = nav.find(
      (n) => (n.pagePath || n.url || "") === p || (n.pagePath || n.url || "") === p.replace(/\/$/, ""),
    );
    if (hit?.label) return hit.label;
    if (isLast && opts.pageTitle) {
      return opts.pageTitle.split("|")[0]!.trim() || fallback;
    }
    return fallback;
  };
  const parts: string[] = [
    `<a href="/">Главная</a>`,
  ];
  let acc = "";
  for (let i = 0; i < segs.length; i++) {
    acc += `/${segs[i]}`;
    const p = `${acc}/`;
    const isLast = i === segs.length - 1;
    const label = labelFor(p, segs[i]!, isLast);
    if (isLast) {
      parts.push(`<span aria-current="page">${esc(label)}</span>`);
    } else {
      parts.push(`<a href="${escAttr(p)}">${esc(label)}</a>`);
    }
  }
  return `<nav class="crumbs" aria-label="Хлебные крошки">${parts.join(" / ")}</nav>`;
}

function renderHero(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const variant = String(data.variant || "home");
  const avHero = Boolean(data.avHero);
  const keysyHero = Boolean(data.keysyHero);
  const av = avHero ? " av-hero" : "";
  const keysy = keysyHero ? " keysy-hero" : "";
  // leadweb: home → hero hero-mascot; sub → hero sub; service → +svc-hero; av без svc на /avtomatizaciya/
  let heroClass: string;
  if (avHero && variant === "home") {
    heroClass = `hero av-hero hero-mascot`;
  } else if (variant === "service") {
    heroClass = `hero${av} svc-hero${keysy} hero-mascot`;
  } else if (variant === "sub") {
    heroClass = "hero sub hero-mascot";
  } else {
    heroClass = `hero${av}${keysy} hero-mascot`;
  }
  const idAttr = anchor ? ` id="${escAttr(anchor)}"` : "";
  const labelled =
    anchor === "hero" ? ' aria-labelledby="hero-title"' : "";
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
  if (
    keysyHero &&
    typeof data.titleHtml === "string" &&
    data.titleHtml.trim()
  ) {
    h1Inner = fixMissingSvgViewBox(sanitizeCmsHtml(data.titleHtml));
  } else if (variant === "home" && accentRaw && !avHero) {
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
    // service/sub/av: visual — отдельная строка без class=visually (как в leadweb)
    const titleVisual = visualRaw
      ? `<span style="display:block;font-size:.5em;font-weight:600;margin-top:.35em">${esc(visualRaw)}</span>`
      : "";
    const rest =
      titleRest && titleRest !== visualRaw ? esc(titleRest) : "";
    h1Inner = [titleAccent, rest, titleVisual].filter(Boolean).join(rest ? " " : "");
  }
  const rings = data.rings
    ? `<div class="rings" aria-hidden="true" data-magic-rings='${escJsonAttr(data.rings)}'></div>`
    : "";
  const blinds = data.gradientBlinds
    ? `<div class="av-bg" aria-hidden="true" data-gradient-blinds='${escJsonAttr(data.gradientBlinds)}'></div><div class="av-veil" aria-hidden="true"></div>`
    : "";
  const mascot = String(data.mascot || "privet");
  const featsList = Array.isArray(data.feats)
    ? (data.feats as Array<{ icon?: string; title?: string | null; text: string }>)
    : [];
  const feats =
    featsList.length > 0
      ? `<div class="feats">${featsList
          .map((f) => {
            const title = (f.title || "").trim();
            const body = (f.text || "").trim();
            const bold = esc(title || body);
            const span =
              title && body ? `<span>${esc(body)}</span>` : "";
            const ic = f.icon ? fixMissingSvgViewBox(String(f.icon)) : "";
            return `<div class="feat">${ic}<b>${bold}</b>${span}</div>`;
          })
          .join("")}</div>`
      : "";
  const crumbs = variant === "home" && !avHero ? "" : renderCrumbs(opts);
  const svcSub =
    typeof data.svcSubHtml === "string" && data.svcSubHtml.trim()
      ? fixMissingSvgViewBox(sanitizeCmsHtml(data.svcSubHtml))
      : "";
  const brand =
    typeof data.brandHtml === "string" && data.brandHtml.trim()
      ? fixMissingSvgViewBox(sanitizeCmsHtml(data.brandHtml))
      : "";
  const notes = Array.isArray(data.notes)
    ? (data.notes as string[])
        .map((n) => `<p class="svc-note">${esc(String(n))}</p>`)
        .join("")
    : "";
  const h1Id = anchor === "hero" ? ' id="hero-title"' : "";
  // leadweb: svc-note между lead и acts
  const copy = `${crumbs}${svcSub}${brand}${
    data.kicker ? `<span class="kicker">${esc(String(data.kicker))}</span>` : ""
  }<h1${h1Id}>${h1Inner}</h1>${
    data.lead ? `<p class="lead">${esc(String(data.lead))}</p>` : ""
  }${notes}${buttonsHtml(data.buttons as never)}`;

  const mascotHtml = renderMascotPicture(mascot, { fetchPriority: "high" });
  // home (не av): <div class="w"><div class="svc-hero-layout">…</div>feats</div>
  // sub/service/av: <div class="w svc-hero-layout">…</div>
  if (variant === "home" && !avHero) {
    return `<section class="${heroClass}"${idAttr}${labelled}>${blinds}${rings}<div class="w"><div class="svc-hero-layout"><div class="svc-hero-copy">${copy}</div>${mascotHtml}</div>${feats}</div></section>`;
  }
  return `<section class="${heroClass}"${idAttr}${labelled}>${blinds}${rings}<div class="w svc-hero-layout"><div class="svc-hero-copy">${copy}</div>${mascotHtml}</div>${feats}</section>`;
}

function renderAnswer(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const factsList = Array.isArray(data.facts)
    ? (data.facts as Array<{ value: string; label: string }>).filter(
        (f) => (f.value || "").trim() || (f.label || "").trim(),
      )
    : [];
  const facts =
    factsList.length > 0
      ? `<div style="margin-top:40px"><div class="facts reveal">${factsList
          .map(
            (f) =>
              `<div class="fact"><b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`,
          )
          .join("")}</div></div>`
      : "";
  let body = richOrMd(data.html, data.text, "basic");
  if (body && !body.includes('class="answer')) {
    if (body.startsWith("<p>")) {
      body = body.replace(/<p>/, '<div class="answer reveal"><p>').replace(/<\/p>$/, "</p></div>");
    } else {
      body = `<div class="answer reveal">${body}</div>`;
    }
  }
  return `${secOpen(anchor)}${secHeader(data.header as Header, opts)}${body}${facts}${secClose()}`;
}

function cardTextHtml(it: Record<string, unknown>): string {
  if (typeof it.textHtml === "string" && it.textHtml.trim()) {
    const raw = it.textHtml.trim();
    // уже с <p> (несколько абзацев, deliver) — basic; иначе inline в одном <p>
    if (/<p[\s>]/i.test(raw)) {
      return richOrMd(raw, null, "basic");
    }
    const inline = richOrMd(raw, null, "inline");
    return inline ? `<p>${inline}</p>` : "";
  }
  if (it.text) return `<p>${esc(String(it.text))}</p>`;
  return "";
}

function renderCardItem(
  it: Record<string, unknown>,
  opts: RenderOptions,
): string {
  const style = String(it.cardStyle || "default");
  const hl = it.highlight ? " hl-card" : "";
  const num = it.num ? `<span class="num">${esc(String(it.num))}</span>` : "";
  const icon = it.icon
    ? `<span class="ibox">${fixMissingSvgViewBox(String(it.icon))}</span>`
    : "";
  const kicker = it.kicker
    ? `<span class="kicker">${esc(String(it.kicker))}</span>`
    : "";
  const price = it.price
    ? `<div class="price">${PRICE_ICON}${esc(String(it.price))}</div>`
    : "";
  const text = cardTextHtml(it);
  const chk = Array.isArray(it.checklist)
    ? `<ul class="chk">${(it.checklist as string[])
        .map((c) => `<li>${CHECK_ICON}${esc(c)}</li>`)
        .join("")}</ul>`
    : "";
  const linkObj =
    it.link && typeof it.link === "object"
      ? (it.link as { href: string; label: string })
      : null;

  if (style === "teaser" && linkObj) {
    const alt = String(it.title || "");
    const media = resolveMediaSrc(it.image, opts.media ?? null, alt);
    let img = "";
    if (media.src.startsWith("/img/")) {
      img = renderStaticImgPicture(media.src, media.alt || alt, {
        sizes: "132px",
      });
    } else if (opts.media) {
      img = renderMediaPicture(it.image, opts.media, {
        fallbackAlt: alt,
        lazy: true,
      });
    } else if (media.src) {
      img = `<img src="${escAttr(media.src)}" alt="${escAttr(media.alt)}" loading="lazy">`;
    }
    return `<a class="card vaybik-teaser reveal" href="${escAttr(linkObj.href)}">${img}<div>${kicker}<h3>${esc(String(it.title || ""))}</h3>${text}<span class="more">${esc(linkObj.label)}${MORE_ARROW}</span></div></a>`;
  }

  if (style === "dir-link" && linkObj) {
    return `<a class="card dir-link reveal" href="${escAttr(linkObj.href)}">${icon}<h3>${esc(String(it.title || ""))}</h3>${text}<span class="more">${esc(linkObj.label)}${MORE_ARROW}</span></a>`;
  }

  const titleText = String(it.title || "");
  const moreAria =
    linkObj && linkObj.label
      ? ` aria-label="${escAttr(`Подробнее: ${titleText}`)}"`
      : "";
  const link = linkObj
    ? `<a class="more" href="${escAttr(linkObj.href)}"${moreAria}>${esc(linkObj.label)}${MORE_ARROW}</a>`
    : "";
  const reveal = wantsReveal(opts) ? " reveal" : "";
  const idAttr =
    typeof it.domId === "string" && it.domId.trim()
      ? ` id="${escAttr(it.domId.trim())}"`
      : "";
  if (kicker && it.highlight) {
    return `<article class="card${reveal}${hl}"${idAttr}>${icon}<div>${kicker}<h3>${esc(titleText)}</h3>${price}${text}${chk}${link}</div></article>`;
  }
  const head = kicker
    ? `${kicker}<h3>${esc(titleText)}</h3>`
    : `<h3>${esc(titleText)}</h3>`;
  return `<article class="card${reveal}${hl}"${idAttr}>${num}${icon}${head}${price}${text}${chk}${link}</article>`;
}

function renderCards(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const cols = Number(data.columns) || 3;
  const items = (data.items as Array<Record<string, unknown>>) || [];
  const gridItems = items.filter((it) => String(it.cardStyle || "default") !== "teaser");
  const teasers = items.filter((it) => String(it.cardStyle || "default") === "teaser");
  const cards = gridItems.map((it) => renderCardItem(it, opts)).join("");
  const teaserHtml = teasers.map((it) => renderCardItem(it, opts)).join("");
  const before =
    typeof data.beforeHtml === "string" && data.beforeHtml.trim()
      ? fixMissingSvgViewBox(sanitizeCmsHtml(data.beforeHtml))
      : "";
  let after =
    typeof data.afterHtml === "string" && data.afterHtml.trim()
      ? fixMissingSvgViewBox(sanitizeCmsHtml(data.afterHtml))
      : "";
  // leadweb: пояснение после проблем на главной
  if (after && /class="lead reveal"/.test(after) && !/style=/.test(after)) {
    after = after.replace(
      /class="lead reveal"/,
      'class="lead reveal" style="margin-top:28px"',
    );
  }
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}${before}<div class="grid g${cols}">${cards}</div>${teaserHtml}${after}${secClose()}`;
}
function renderFaq(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const items =
    (data.items as Array<{
      question: string;
      icon?: string | null;
      answer?: string;
      answerHtml?: string;
    }>) || [];
  const details = items
    .map((it) => {
      const icon = it.icon
        ? fixMissingSvgViewBox(String(it.icon))
        : FAQ_ICON;
      return `<details><summary>${icon}<span>${esc(it.question)}</span>${FAQ_CHEV}</summary><div>${richOrMd(it.answerHtml, it.answer, "basic")}</div></details>`;
    })
    .join("");
  return `${secOpen(anchor || "faq", data.background === "alt")}${secHeader(data.header as Header, opts)}<div class="faq reveal">${details}</div>${secClose()}`;
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
      const links = Array.isArray(p.links)
        ? `<div class="links">${(p.links as Array<{ label: string; href: string; icon?: string | null }>)
            .map((l) => {
              const ext =
                /^https?:\/\//i.test(l.href) && !l.href.includes("vaybik.ru")
                  ? ' target="_blank" rel="noopener"'
                  : "";
              const ic = l.icon ? fixMissingSvgViewBox(String(l.icon)) : "";
              return `<a href="${escAttr(l.href)}"${ext}>${ic}${esc(l.label)}</a>`;
            })
            .join("")}</div>`
        : "";
      return `<article class="person reveal">${img}<div><h3>${esc(String(p.name || ""))}</h3><div class="role">${esc(String(p.role || ""))}</div>${p.quote ? `<q>${esc(String(p.quote))}</q>` : ""}<p class="muted">${bio}</p>${links}</div></article>`;
    })
    .join("");
  return `${secOpen(anchor || "team", data.background === "alt")}${secHeader(data.header as Header, opts)}<div class="team">${html}</div>${secClose()}`;
}

function renderCases(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const items = (data.items as Array<Record<string, unknown>>) || [];
  const variant = String(data.variant || "default");
  const cards = items
    .map((it) => {
      const tag = String(it.tag || it.kicker || "");
      const title = esc(String(it.title || ""));
      const kicker = tag ? `<span class="kicker">${esc(tag)}</span>` : "";
      const before = it.before != null ? String(it.before).trim() : "";
      const didHtml = richOrMd(it.didHtml, null, "basic");
      const result = it.result != null ? String(it.result).trim() : "";
      const hasDl = before || didHtml || result;

      const alt = String(it.imageAlt || it.title || "");
      const w = typeof it.imageWidth === "number" ? it.imageWidth : null;
      const h = typeof it.imageHeight === "number" ? it.imageHeight : null;
      const media = resolveMediaSrc(it.image, opts.media ?? null, alt);
      let img = "";
      if (media.src.startsWith("/img/")) {
        img = renderStaticImgPicture(media.src, media.alt || alt, {
          width: w,
          height: h,
          sizes: "260px",
        });
      } else if (opts.media) {
        img = renderMediaPicture(it.image, opts.media, {
          fallbackAlt: alt,
          lazy: true,
          width: w,
          height: h,
        });
      } else if (media.src) {
        img = renderStaticImgPicture(media.src, media.alt || alt, {
          width: w,
          height: h,
          sizes: "260px",
        });
      }

      let body: string;
      if (hasDl) {
        const rows: string[] = [];
        if (before) rows.push(`<dt>Было</dt><dd>${esc(before)}</dd>`);
        if (didHtml) rows.push(`<dt>Сделали</dt><dd>${didHtml}</dd>`);
        if (result) rows.push(`<dt>Результат</dt><dd>${esc(result)}</dd>`);
        body = `<dl>${rows.join("")}</dl>`;
      } else {
        const caseText =
          it.textHtml && String(it.textHtml).trim()
            ? richOrMd(it.textHtml, null, "basic")
            : esc(String(it.text || ""));
        body = caseText
          ? caseText.startsWith("<")
            ? caseText
            : `<p>${caseText}</p>`
          : "";
        if (result && !hasDl) body += `<p><em>${esc(result)}</em></p>`;
      }

      const moreLabel = String(it.more || "").trim();
      const href = it.href ? String(it.href) : "";
      const external =
        /^https?:\/\//i.test(href) && !/vaybik\.ru/i.test(href);
      const more =
        href && moreLabel
          ? `<a class="more" href="${escAttr(href)}"${
              external ? ' target="_blank" rel="noopener"' : ""
            }>${esc(moreLabel)}${external ? EXT_MORE_ICON : ""}</a>`
          : "";
      const caseReveal = wantsReveal(opts) ? " reveal" : "";

      if (variant === "portfolio" || img || hasDl) {
        const inner = `${img}<div>${kicker}<h3>${title}</h3>${body}${more}</div>`;
        return `<article class="card case${caseReveal}">${inner}</article>`;
      }

      const inner = `${kicker}<h3>${title}</h3>${body}`;
      if (href) {
        return `<a class="card case${caseReveal}" href="${escAttr(href)}">${inner}</a>`;
      }
      return `<article class="card case${caseReveal}">${inner}</article>`;
    })
    .join("");
  // leadweb portfolio: class="grid" без g3
  const gridCls = variant === "portfolio" ? "grid" : "grid g3";
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}<div class="${gridCls}">${cards}</div>${secClose()}`;
}
function renderCta(
  data: Record<string, unknown>,
  anchor?: string | null,
): string {
  const rings = data.rings
    ? `<div class="sec-rings" aria-hidden="true" data-magic-rings='${escAttr(JSON.stringify(data.rings))}'></div>`
    : "";
  return `${secOpen(anchor, data.background === "alt")}<div class="cta reveal">${rings}<div class="w2"><h2>${esc(String(data.title || ""))}</h2>${
    data.lead ? `<p class="lead">${esc(String(data.lead))}</p>` : ""
  }${buttonsHtml(data.buttons as never)}</div></div>${secClose()}`;
}

function renderText(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const body = richOrMd(data.html, data.markdown, "full");
  const wrap =
    data.layout === "two"
      ? `<div class="grid g2 reveal">${body}</div>`
      : `<div class="reveal">${body}</div>`;
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}${wrap}${secClose()}`;
}

function renderWidget(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions,
): string {
  return renderWidgetHtml(data, opts.mode || "preview", anchor);
}

function renderRawHtml(data: Record<string, unknown>, anchor?: string | null): string {
  const html = fixMissingSvgViewBox(sanitizeCmsHtml(String(data.html || "")));
  if (html.trim().startsWith("<section")) return html;
  const id = anchor ? ` id="${escAttr(anchor)}"` : "";
  return `<section class="sec"${id}>${html}</section>`;
}

function renderIconList(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const variant = String(data.variant || "plist-cards");
  const items = (data.items as Array<Record<string, unknown>>) || [];
  if (variant === "safe") {
    const lis = items
      .map((it) => {
        const body = richOrMd(it.textHtml, it.text, "inline");
        const ic = it.icon ? fixMissingSvgViewBox(String(it.icon)) : "";
        return `<li><span class="ibox">${ic}</span><div><h3>${esc(String(it.title || ""))}</h3><p>${body}</p></div></li>`;
      })
      .join("");
    return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}<ul class="safe reveal">${lis}</ul>${secClose()}`;
  }
  const lis = items
    .map((it) => {
      const body = richOrMd(it.textHtml, it.text, "inline");
      const ic = it.icon ? fixMissingSvgViewBox(String(it.icon)) : "";
      return `<li><span class="ibox">${ic}</span><span>${body || esc(String(it.title || ""))}</span></li>`;
    })
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}<ul class="plist-cards reveal">${lis}</ul>${secClose()}`;
}

function renderOffer(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const items = (data.items as Array<Record<string, unknown>>) || [];
  const cards = items
    .map((it) => {
      const hl = it.highlight ? " hl-box" : "";
      const priceStyle =
        typeof it.priceStyle === "string" && it.priceStyle.trim()
          ? ` style="${escAttr(it.priceStyle.trim())}"`
          : "";
      const price =
        typeof it.price === "string" && it.price.trim()
          ? `<div class="price"${priceStyle}>${fixMissingSvgViewBox(sanitizeCmsHtml(it.price))}</div>`
          : "";
      return `<div class="answer reveal${hl}">${
        it.kicker ? `<span class="kicker">${esc(String(it.kicker))}</span>` : ""
      }${price}${richOrMd(it.html, null, "basic")}</div>`;
    })
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}<div class="grid g2">${cards}</div>${secClose()}`;
}

function renderBeforeAfter(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
  const items = (data.items as Array<{ before: string; after: string }>) || [];
  const lis = items
    .map(
      (it) =>
        `<li><span class="ba-before">${esc(it.before)}</span><span class="ba-after">${esc(it.after)}</span></li>`,
    )
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}<ul class="ba-list reveal">${lis}</ul>${secClose()}`;
}

function renderSteps(
  data: Record<string, unknown>,
  anchor: string | null | undefined,
  opts: RenderOptions = {},
): string {
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
      .map((it, i) => {
        const ic = it.icon
          ? `<span class="ibox">${fixMissingSvgViewBox(String(it.icon))}</span>`
          : "";
        return `<li><span class="num">${i + 1}</span>${ic}<b>${esc(it.title)}</b><span>${esc(it.text)}</span><em>${esc(it.result)}</em></li>`;
      })
      .join("");
    return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}<ol class="flow5 reveal">${lis}</ol>${secClose()}`;
  }
  if (variant === "av" || variant === "k-steps") {
    const cls = variant === "av" ? "steps av-steps" : "steps k-steps";
    const lis = items
      .map((it) => {
        const ic = it.icon
          ? `<span class="ibox">${fixMissingSvgViewBox(String(it.icon))}</span>`
          : "";
        return `<li>${ic}<b>${esc(it.title)}</b><span>${esc(it.text)}</span><em>${esc(it.result)}</em></li>`;
      })
      .join("");
    return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}<ol class="${cls} reveal">${lis}</ol>${secClose()}`;
  }
  const lis = items
    .map(
      (it) =>
        `<li><b>${esc(it.title)}</b><span>${esc(it.text)}</span><em>${esc(it.result)}</em></li>`,
    )
    .join("");
  return `${secOpen(anchor, data.background === "alt")}${secHeader(data.header as Header, opts)}<ol class="steps reveal">${lis}</ol>${secClose()}`;
}

export function renderBlock(
  block: RenderBlock,
  opts: RenderOptions = {},
): string {
  if (block.isHidden) return "";
  const data = (block.data || {}) as Record<string, unknown>;
  switch (block.type) {
    case "hero":
      return renderHero(data, block.anchor, opts);
    case "answer":
      return renderAnswer(data, block.anchor, opts);
    case "cards":
      return renderCards(data, block.anchor, opts);
    case "steps":
      return renderSteps(data, block.anchor, opts);
    case "faq":
      return renderFaq(data, block.anchor, opts);
    case "team":
      return renderTeam(data, block.anchor, opts);
    case "cases":
      return renderCases(data, block.anchor, opts);
    case "cta":
      return renderCta(data, block.anchor);
    case "text":
      return renderText(data, block.anchor, opts);
    case "widget":
      return renderWidget(data, block.anchor, opts);
    case "iconList":
      return renderIconList(data, block.anchor, opts);
    case "offer":
      return renderOffer(data, block.anchor, opts);
    case "beforeAfter":
      return renderBeforeAfter(data, block.anchor, opts);
    case "rawHtml":
      return renderRawHtml(data, block.anchor);
    default:
      return `<!-- unknown block ${esc(block.type)} -->`;
  }
}

export function pageHasCalcFull(blocks: RenderBlock[]): boolean {
  return blocks.some((b) => {
    if (b.type !== "widget" || b.isHidden) return false;
    const data = (b.data || {}) as Record<string, unknown>;
    return data.key === "calcFull";
  });
}

export function renderBlocks(
  blocks: RenderBlock[],
  opts: RenderOptions = {},
): string {
  // calcFull.html уже содержит section.hero.lc-hero — не дублировать блок hero
  const skipHero = pageHasCalcFull(blocks);
  const html = blocks
    .filter((b) => !(skipHero && b.type === "hero"))
    .map((b) => renderBlock(b, opts))
    .join("\n");
  return fixMissingSvgViewBox(html);
}
