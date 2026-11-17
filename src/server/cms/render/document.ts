import { esc, escAttr } from "./escape";
import { renderBlocks, type RenderBlock } from "./blocks";

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

function hrefOf(item: NavRenderItem): string {
  return item.url || item.pagePath || "#";
}

function renderHeaderNav(items: NavRenderItem[]): string {
  const roots = items
    .filter((i) => i.menu === "HEADER" && !i.parentId && !i.isHidden)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const parts = roots.map((root) => {
    const children = items
      .filter((c) => c.parentId === root.id && !c.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const target = root.openInNewTab ? ' target="_blank" rel="noopener"' : "";
    if (!children.length) {
      return `<div class="nav-item"><a class="nav-link" href="${escAttr(hrefOf(root))}"${target}>${esc(root.label)}</a></div>`;
    }
    const sub = children
      .map((c) => {
        const hl = c.isHighlighted ? ' class="sub-hl"' : "";
        const t = c.openInNewTab ? ' target="_blank" rel="noopener"' : "";
        return `<li><a href="${escAttr(hrefOf(c))}"${hl}${t}>${esc(c.label)}</a></li>`;
      })
      .join("");
    return `<div class="nav-item has-sub"><a class="nav-link" href="${escAttr(hrefOf(root))}">${esc(root.label)}</a><ul class="nav-sub">${sub}</ul></div>`;
  });

  return parts.join("");
}

function renderFooter(items: NavRenderItem[]): string {
  const roots = items
    .filter((i) => i.menu === "FOOTER" && !i.parentId && !i.isHidden)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const cols = roots
    .map((root) => {
      const children = items
        .filter((c) => c.parentId === root.id && !c.isHidden)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const links = children
        .map((c) => {
          const t = c.openInNewTab ? ' target="_blank" rel="noopener"' : "";
          return `<a href="${escAttr(hrefOf(c))}"${t}>${esc(c.label)}</a>`;
        })
        .join("");
      return `<div><h3>${esc(root.label)}</h3>${links}</div>`;
    })
    .join("");

  return `<footer class="ftr"><div class="w"><div class="grid"><div><a class="logo" href="/">vaybik<b>.</b>ru</a></div>${cols}</div></div></footer>`;
}

export function renderPreviewDocument(opts: {
  title: string;
  template: string;
  blocks: RenderBlock[];
  nav: NavRenderItem[];
  assetsOrigin: string;
  banner: string;
}): string {
  const origin = opts.assetsOrigin.replace(/\/$/, "");
  const extraCss =
    opts.template === "service" || opts.template === "calculator"
      ? `<link rel="stylesheet" href="${escAttr(origin)}/css/service-pages.css">`
      : opts.template === "home"
        ? ""
        : "";
  const keysy =
    opts.template === "default"
      ? ""
      : "";

  const body = renderBlocks(opts.blocks);
  const headerNav = renderHeaderNav(opts.nav);
  const footer = renderFooter(opts.nav);

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title)} — предпросмотр</title>
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="${escAttr(origin)}/css/fonts.css">
<link rel="stylesheet" href="${escAttr(origin)}/css/site.css">
${extraCss}${keysy}
<style>
.reveal{opacity:1;transform:none}
.cms-preview-banner{position:sticky;top:0;z-index:9999;background:#1a1030;color:#fff;padding:10px 16px;font:600 14px/1.4 Manrope,system-ui,sans-serif;border-bottom:2px solid #ff8a1f}
.cms-preview-banner a{color:#ff8a1f}
</style>
</head>
<body>
<div class="cms-preview-banner">${esc(opts.banner)}</div>
<a class="skip" href="#main">К содержанию</a>
<header class="hdr"><div class="w">
<a class="logo" href="/">vaybik<b>.</b>ru</a>
<nav class="nav" aria-label="Основное меню">${headerNav}</nav>
</div></header>
<main id="main">${body}</main>
${footer}
</body>
</html>`;
}
