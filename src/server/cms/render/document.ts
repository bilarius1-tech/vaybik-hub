import {
  chatWidgetApplies,
  renderChatWidgetScript,
  type ChatWidgetConfig,
} from "@/server/cms/chat-widget";
import {
  assetsForTemplate,
  mergeAssetVersions,
  type SiteAssetVersions,
} from "./assets";
import { esc, escAttr } from "./escape";
import {
  renderBlocks,
  type MediaRenderContext,
  type RenderBlock,
} from "./blocks";

export type NavRenderItem = {
  id: string;
  menu: "HEADER" | "FOOTER";
  parentId: string | null;
  label: string;
  url: string | null;
  pagePath?: string | null;
  isHidden: boolean;
  isHighlighted: boolean;
  openInNewTab: boolean;
  sortOrder: number;
};

export type SeoRenderData = {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  robots?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterCard?: string | null;
  jsonLd?: unknown;
};

export type ContactsRender = {
  email?: string | null;
  telegram?: string | null;
};

export type RenderMode = "public" | "preview";

const CARET_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

const TG_SVG = `<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>`;

const MAIL_SVG = `<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;

function hrefOf(item: NavRenderItem): string {
  return item.url || item.pagePath || "#";
}

/** Как в leadweb: sub-uslugi / sub-auto, не кириллица. */
const SUBMENU_SLUGS: Record<string, string> = {
  Услуги: "uslugi",
  Автоматизация: "auto",
};

const CYR_TO_LAT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function slugForSub(label: string, id: string): string {
  if (SUBMENU_SLUGS[label]) return SUBMENU_SLUGS[label];
  const s = label
    .toLowerCase()
    .split("")
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return s || id.slice(0, 8);
}

/** Пункт «Обсудить проект» дублирует hdr-cta — в меню leadweb его нет. */
function isDiscussCta(item: NavRenderItem): boolean {
  return (
    /^обсудить проект$/i.test(item.label.trim()) &&
    /t\.me\//i.test(item.url || item.pagePath || "")
  );
}

function normPath(p: string): string {
  if (!p || p === "/") return "/";
  const noHash = p.split("#")[0] || "/";
  return noHash.endsWith("/") ? noHash : `${noHash}/`;
}

/** Точное совпадение пути (hash в href меню не участвует в current страницы). */
function isExactCurrent(href: string, currentPath: string | undefined): boolean {
  if (!currentPath || !href || href === "#" || /^https?:/i.test(href)) {
    return false;
  }
  if (href.includes("#")) return false;
  return normPath(href) === normPath(currentPath);
}

function renderHeaderNav(
  items: NavRenderItem[],
  currentPath?: string,
): string {
  const roots = items
    .filter(
      (i) =>
        i.menu === "HEADER" &&
        !i.parentId &&
        !i.isHidden &&
        !isDiscussCta(i),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return roots
    .map((root) => {
      const children = items
        .filter((c) => c.parentId === root.id && !c.isHidden)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const href = hrefOf(root);
      const target = root.openInNewTab
        ? ' target="_blank" rel="noopener"'
        : "";
      if (!children.length) {
        const current = isExactCurrent(href, currentPath)
          ? ' aria-current="page"'
          : "";
        return `<div class="nav-item"><a class="nav-link" href="${escAttr(href)}"${target}${current}>${esc(root.label)}</a></div>`;
      }
      const childCurrent = children.some((c) =>
        isExactCurrent(hrefOf(c), currentPath),
      );
      // leadweb: exact родителя → page; иначе true, если активен пункт подменю
      const parentCurrent = isExactCurrent(href, currentPath)
        ? ' aria-current="page"'
        : childCurrent
          ? ' aria-current="true"'
          : "";
      const subId = `sub-${slugForSub(root.label, root.id)}`;
      const sub = children
        .map((c) => {
          const chref = hrefOf(c);
          const hl = c.isHighlighted ? ' class="sub-hl"' : "";
          const t = c.openInNewTab
            ? ' target="_blank" rel="noopener"'
            : "";
          const cur = isExactCurrent(chref, currentPath)
            ? ' aria-current="page"'
            : "";
          return `<li><a href="${escAttr(chref)}"${hl}${t}${cur}>${esc(c.label)}</a></li>`;
        })
        .join("");
      return `<div class="nav-item has-sub"><a class="nav-link" href="${escAttr(href)}"${parentCurrent}>${esc(root.label)}</a><button class="nav-caret" type="button" aria-expanded="false" aria-controls="${escAttr(subId)}" aria-label="Подменю: ${escAttr(root.label)}">${CARET_SVG}</button><ul class="nav-sub" id="${escAttr(subId)}">${sub}</ul></div>`;
    })
    .join("");
}

function renderMobileMenu(
  items: NavRenderItem[],
  contacts: ContactsRender,
  currentPath?: string,
): string {
  const roots = items
    .filter(
      (i) =>
        i.menu === "HEADER" &&
        !i.parentId &&
        !i.isHidden &&
        !isDiscussCta(i),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const homeCurrent = isExactCurrent("/", currentPath)
    ? ' aria-current="page"'
    : "";
  const parts: string[] = [`<a href="/"${homeCurrent}>Главная</a>`];

  for (const root of roots) {
    const children = items
      .filter((c) => c.parentId === root.id && !c.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (root.isHighlighted) {
      const cur = isExactCurrent(hrefOf(root), currentPath)
        ? ' aria-current="page"'
        : "";
      parts.push(
        `<a class="menu-hl" href="${escAttr(hrefOf(root))}"${cur}>${esc(root.label)}</a>`,
      );
      continue;
    }
    if (!children.length) {
      const cur = isExactCurrent(hrefOf(root), currentPath)
        ? ' aria-current="page"'
        : "";
      parts.push(
        `<a href="${escAttr(hrefOf(root))}"${cur}>${esc(root.label)}</a>`,
      );
      continue;
    }
    const lis = children
      .map((c) => {
        const cur = isExactCurrent(hrefOf(c), currentPath)
          ? ' aria-current="page"'
          : "";
        return `<a href="${escAttr(hrefOf(c))}"${cur}>${esc(c.label)}</a>`;
      })
      .join("");
    parts.push(
      `<details class="menu-acc"><summary>${esc(root.label)}</summary><div class="menu-acc-list">${lis}</div></details>`,
    );
  }

  const tg =
    contacts.telegram ||
    process.env.SITE_DEFAULT_TELEGRAM ||
    "https://t.me/bilarius";
  const email =
    contacts.email ||
    process.env.SITE_DEFAULT_EMAIL ||
    "bilariuss@yandex.ru";
  const tgLabel = tg.replace(/^https?:\/\/t\.me\//i, "@");

  return `<div class="menu" id="menu" hidden role="dialog" aria-modal="true" aria-label="Меню"><div class="menu-back" data-close-menu tabindex="-1"></div><div class="menu-panel"><div class="menu-top"><span class="logo">vaybik<b>.</b>ru</span><button class="mclose" type="button" aria-label="Закрыть меню">×</button></div><nav aria-label="Мобильное меню">${parts.join("")}</nav><div class="menu-ft"><a class="bt-btn" href="${escAttr(tg)}" target="_blank" rel="noopener"><span class="bt-sl">Обсудить проект</span></a><div class="menu-ft-links"><a href="${escAttr(tg)}" target="_blank" rel="noopener">${TG_SVG}Telegram ${esc(tgLabel)}</a><a href="mailto:${escAttr(email)}">${MAIL_SVG}${esc(email)}</a></div></div></div></div>`;
}

function renderFooter(
  items: NavRenderItem[],
  year: number,
  opts?: {
    includeHomeLink?: boolean;
    currentPath?: string;
    /** aria-current в футере только на body.svc (как в leadweb) */
    markCurrent?: boolean;
  },
): string {
  const roots = items
    .filter((i) => i.menu === "FOOTER" && !i.parentId && !i.isHidden)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  type FootLink = { href: string; label: string; openInNewTab: boolean };
  const colData = roots.map((root) => ({
    label: root.label,
    prefixHome: Boolean(
      opts?.includeHomeLink && /разделы/i.test(root.label),
    ),
    children: items
      .filter((c) => c.parentId === root.id && !c.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(
        (c): FootLink => ({
          href: hrefOf(c),
          label: c.label,
          openInNewTab: c.openInNewTab,
        }),
      ),
  }));

  // leadweb: aria-current на последнем совпадении пути (колонка «Разделы»)
  let lastMatch: { colIdx: number; childIdx: number } | null = null;
  if (opts?.markCurrent && opts.currentPath) {
    colData.forEach((col, colIdx) => {
      col.children.forEach((c, childIdx) => {
        if (isExactCurrent(c.href, opts.currentPath)) {
          lastMatch = { colIdx, childIdx };
        }
      });
    });
  }

  const cols = colData
    .map((col, colIdx) => {
      const prefix = col.prefixHome ? `<a href="/">Главная</a>` : "";
      const links = col.children
        .map((c, childIdx) => {
          const t = c.openInNewTab ? ' target="_blank" rel="noopener"' : "";
          const cur =
            lastMatch &&
            lastMatch.colIdx === colIdx &&
            lastMatch.childIdx === childIdx
              ? ' aria-current="page"'
              : "";
          return `<a href="${escAttr(c.href)}"${t}${cur}>${esc(c.label)}</a>`;
        })
        .join("");
      return `<div><h3>${esc(col.label)}</h3>${prefix}${links}</div>`;
    })
    .join("");

  return `<footer class="ftr"><div class="w"><div class="grid"><div><a class="logo" href="/">vaybik<b>.</b>ru</a><p>Команда из двух разработчиков — Алексея и Игоря. Делаем сайты, презентации и калькуляторы, которые приводят заявки: дизайн, разработка, SEO и реклама в одних руках.</p></div>${cols}</div><p style="margin-top:32px">© ${year} vaybik.ru. Сайты, которые приводят заявки. <a class="ftr-team" href="/kp/" rel="nofollow" style="opacity:.55;margin-left:12px">Калькулятор для команды</a></p></div></footer>`;
}

function renderHead(opts: {
  mode: RenderMode;
  title: string;
  path: string;
  seo: SeoRenderData | null;
  assetsOrigin: string;
  siteOrigin: string;
  cssHrefs: string[];
  noindexHost?: boolean;
  skipCanonical?: boolean;
}): string {
  const seo = opts.seo || {};
  const title = seo.title || opts.title;
  const desc = seo.description || "";
  const canonical =
    seo.canonical ||
    `${opts.siteOrigin.replace(/\/$/, "")}${opts.path === "/" ? "/" : opts.path}`;
  const robots =
    opts.mode === "preview" || opts.noindexHost
      ? opts.mode === "preview"
        ? "noindex,nofollow"
        : seo.robots || "noindex,nofollow"
      : seo.robots || "index,follow,max-image-preview:large";
  const ogTitle = seo.ogTitle || title;
  const ogDesc = seo.ogDescription || desc;
  const ogImage =
    seo.ogImage || `${opts.siteOrigin.replace(/\/$/, "")}/img/og.jpg`;
  const twitterCard = seo.twitterCard || "summary_large_image";

  let jsonLd = "";
  if (opts.mode === "public" && seo.jsonLd) {
    const raw =
      typeof seo.jsonLd === "string"
        ? seo.jsonLd
        : JSON.stringify(seo.jsonLd);
    jsonLd = `<script type="application/ld+json">${raw.replace(/</g, "\\u003c")}</script>`;
  }

  const origin = opts.assetsOrigin.replace(/\/$/, "");
  const abs = (href: string) =>
    href.startsWith("http") ? href : `${origin}${href}`;

  const css = opts.cssHrefs
    .map((h) => `<link rel="stylesheet" href="${escAttr(abs(h))}">`)
    .join("");

  const previewTitle =
    opts.mode === "preview" ? `${esc(title)} — предпросмотр` : esc(title);

  const showCanonical =
    opts.mode === "public" && !opts.noindexHost && !opts.skipCanonical;

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${previewTitle}</title>
${desc ? `<meta name="description" content="${escAttr(desc)}">` : ""}
${showCanonical ? `<link rel="canonical" href="${escAttr(canonical)}">` : ""}
<meta name="robots" content="${escAttr(robots)}">
<meta name="theme-color" content="#07051a">
<meta property="og:type" content="website"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="vaybik.ru">
<meta property="og:title" content="${escAttr(ogTitle)}"><meta property="og:description" content="${escAttr(ogDesc)}">
<meta property="og:url" content="${escAttr(canonical)}"><meta property="og:image" content="${escAttr(ogImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escAttr(ogTitle)}">
<meta name="twitter:card" content="${escAttr(twitterCard)}"><meta name="twitter:title" content="${escAttr(ogTitle)}"><meta name="twitter:description" content="${escAttr(ogDesc)}"><meta name="twitter:image" content="${escAttr(ogImage)}">
<link rel="icon" href="${escAttr(abs("/img/favicon.svg"))}" type="image/svg+xml">
<link rel="preload" href="${escAttr(abs("/fonts/manrope-cyrillic-400-normal.woff2"))}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${escAttr(abs("/fonts/unbounded-cyrillic-500-normal.woff2"))}" as="font" type="font/woff2" crossorigin>
${css}
<link rel="alternate" type="text/plain" href="${escAttr(abs("/llms.txt"))}" title="llms.txt">
${jsonLd}`;
}

export type SiteDocumentOpts = {
  mode: RenderMode;
  title: string;
  path: string;
  template: string;
  blocks: RenderBlock[];
  nav: NavRenderItem[];
  seo?: SeoRenderData | null;
  contacts?: ContactsRender;
  assetsOrigin: string;
  /** Публичный origin для canonical/OG (site-test или vaybik.ru) */
  siteOrigin: string;
  assetVersions?: Partial<SiteAssetVersions> | null;
  media?: MediaRenderContext | null;
  banner?: string;
  noindexHost?: boolean;
  year?: number;
  /** ИИ-консультант; только mode=public */
  chatWidget?: ChatWidgetConfig | null;
};

export function renderSiteDocument(opts: SiteDocumentOpts): string {
  const versions = mergeAssetVersions(opts.assetVersions);
  const assets = assetsForTemplate(opts.template, versions);
  const body = renderBlocks(opts.blocks, {
    mode: opts.mode,
    media: opts.media,
    path: opts.path,
    pageTitle: opts.title,
    template: opts.template,
    nav: opts.nav,
  });
  const headerNav = renderHeaderNav(opts.nav, opts.path);
  const contacts = opts.contacts || {};
  const tg =
    contacts.telegram ||
    process.env.SITE_DEFAULT_TELEGRAM ||
    "https://t.me/bilarius";
  const mobile = renderMobileMenu(opts.nav, contacts, opts.path);
  const footer = renderFooter(
    opts.nav,
    opts.year || new Date().getFullYear(),
    {
      // как в leadweb: Главная в футере только на svc / calculator
      includeHomeLink:
        assets.bodyClass === "svc" || assets.bodyClass === "lc-page",
      currentPath: opts.path,
      // aria-current в футере — только body.svc (не lc-page / default)
      markCurrent: assets.bodyClass === "svc",
    },
  );
  const head = renderHead({
    mode: opts.mode,
    title: opts.title,
    path: opts.path,
    seo: opts.seo || null,
    assetsOrigin: opts.assetsOrigin,
    siteOrigin: opts.siteOrigin,
    cssHrefs: assets.css,
    noindexHost: opts.noindexHost,
  });

  const origin = opts.assetsOrigin.replace(/\/$/, "");
  const siteScripts =
    opts.mode === "public"
      ? assets.js
          .map(
            (s) =>
              `<script src="${escAttr(s.startsWith("http") ? s : `${origin}${s}`)}" defer></script>`,
          )
          .join("")
      : "";
  const chatScript =
    opts.mode === "public" &&
    opts.chatWidget &&
    chatWidgetApplies(opts.chatWidget, opts.path)
      ? renderChatWidgetScript(opts.chatWidget)
      : "";
  const scripts = [siteScripts, chatScript].filter(Boolean).join("\n");

  const previewStyle =
    opts.mode === "preview"
      ? `<style>
.reveal{opacity:1;transform:none}
.cms-preview-banner{position:sticky;top:0;z-index:9999;background:#1a1030;color:#fff;padding:10px 16px;font:600 14px/1.4 Manrope,system-ui,sans-serif;border-bottom:2px solid #ff8a1f}
.cms-preview-banner a{color:#ff8a1f}
</style>`
      : "";

  const banner =
    opts.mode === "preview" && opts.banner
      ? `<div class="cms-preview-banner">${esc(opts.banner)}</div>`
      : "";

  const bodyClass = assets.bodyClass
    ? ` class="${escAttr(assets.bodyClass)}"`
    : "";
  const bodyAttrs = assets.bodyAttrs || "";

  return `<!doctype html>
<html lang="ru">
<head>
${head}
${previewStyle}
</head>
<body${bodyClass}${bodyAttrs}>
${banner}
<a class="skip" href="#main">К содержанию</a>
<header class="hdr"><div class="w">
<a class="logo" href="/" aria-label="vaybik.ru — на главную">vaybik<b>.</b>ru</a>
<nav class="nav" aria-label="Основное меню">${headerNav}</nav>
<a class="bt-btn hdr-cta" href="${escAttr(tg)}" target="_blank" rel="noopener"><span class="bt-sl">Обсудить проект</span></a>
<button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="menu"><span></span></button>
</div></header>
${mobile}
<main id="main">${body}</main>
${assets.afterMain || ""}
${footer}
${scripts}
</body>
</html>`;
}

/** @deprecated используйте renderSiteDocument(..., mode: "preview") */
export function renderPreviewDocument(opts: {
  title: string;
  template: string;
  blocks: RenderBlock[];
  nav: NavRenderItem[];
  assetsOrigin: string;
  banner: string;
  path?: string;
}): string {
  return renderSiteDocument({
    mode: "preview",
    title: opts.title,
    path: opts.path || "/",
    template: opts.template,
    blocks: opts.blocks,
    nav: opts.nav,
    assetsOrigin: opts.assetsOrigin,
    siteOrigin: opts.assetsOrigin,
    banner: opts.banner,
  });
}

export function renderNotFoundDocument(opts: {
  nav: NavRenderItem[];
  contacts?: ContactsRender;
  assetsOrigin: string;
  siteOrigin: string;
  assetVersions?: Partial<SiteAssetVersions> | null;
  year?: number;
}): string {
  const versions = mergeAssetVersions(opts.assetVersions);
  const assets = assetsForTemplate("default", versions);
  const head = renderHead({
    mode: "public",
    title: "Страница не найдена — vaybik.ru",
    path: "/404.html",
    seo: {
      title: "Страница не найдена — vaybik.ru",
      description: "Такой страницы нет. Перейдите на главную vaybik.ru.",
      robots: "noindex,max-image-preview:large",
      ogTitle: "vaybik.ru",
      ogDescription: "Такой страницы нет. Перейдите на главную vaybik.ru.",
    },
    assetsOrigin: opts.assetsOrigin,
    siteOrigin: opts.siteOrigin,
    cssHrefs: assets.css,
    skipCanonical: true,
  });
  const contacts = opts.contacts || {};
  const tg =
    contacts.telegram ||
    process.env.SITE_DEFAULT_TELEGRAM ||
    "https://t.me/bilarius";
  const origin = opts.assetsOrigin.replace(/\/$/, "");
  const scripts = assets.js
    .map(
      (s) =>
        `<script src="${escAttr(s.startsWith("http") ? s : `${origin}${s}`)}" defer></script>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ru">
<head>
${head}
</head>
<body>
<a class="skip" href="#main">К содержанию</a>
<header class="hdr"><div class="w">
<a class="logo" href="/" aria-label="vaybik.ru — на главную">vaybik<b>.</b>ru</a>
<nav class="nav" aria-label="Основное меню">${renderHeaderNav(opts.nav)}</nav>
<a class="bt-btn hdr-cta" href="${escAttr(tg)}" target="_blank" rel="noopener"><span class="bt-sl">Обсудить проект</span></a>
<button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="menu"><span></span></button>
</div></header>
${renderMobileMenu(opts.nav, contacts)}
<main id="main"><section class="hero sub"><div class="w"><span class="kicker">404</span><h1>Страницы нет</h1><p class="lead">Такой адрес не найден. Вернитесь на главную или выберите раздел в меню.</p><div class="acts"><a class="bt-btn" href="/"><span class="bt-sl">На главную</span></a></div></div></section></main>
${renderFooter(opts.nav, opts.year || new Date().getFullYear())}
${scripts}
</body>
</html>`;
}
