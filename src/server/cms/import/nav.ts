import * as cheerio from "cheerio";

export type ImportedNavItem = {
  menu: "HEADER" | "FOOTER";
  parentLabel: string | null;
  label: string;
  url: string;
  isHighlighted: boolean;
  openInNewTab: boolean;
  sortOrder: number;
};

export function extractNavFromIndex(html: string): ImportedNavItem[] {
  const $ = cheerio.load(html);
  const items: ImportedNavItem[] = [];
  let order = 0;

  $("header.hdr nav.nav > .nav-item").each((_, el) => {
    const $el = $(el);
    const $link = $el.children("a.nav-link").first();
    const label = $link.text().replace(/\s+/g, " ").trim();
    const url = $link.attr("href") || "#";
    const parentOrder = order++;
    items.push({
      menu: "HEADER",
      parentLabel: null,
      label,
      url,
      isHighlighted: false,
      openInNewTab: false,
      sortOrder: parentOrder,
    });
    let childOrder = 0;
    $el.find(".nav-sub a").each((_, a) => {
      const $a = $(a);
      items.push({
        menu: "HEADER",
        parentLabel: label,
        label: $a.text().replace(/\s+/g, " ").trim(),
        url: $a.attr("href") || "#",
        isHighlighted: ($a.attr("class") || "").includes("sub-hl"),
        openInNewTab: false,
        sortOrder: childOrder++,
      });
    });
  });

  // CTA в шапке
  const $cta = $("header.hdr a.hdr-cta").first();
  if ($cta.length) {
    items.push({
      menu: "HEADER",
      parentLabel: null,
      label: $cta.text().replace(/\s+/g, " ").trim() || "Обсудить проект",
      url: $cta.attr("href") || "https://t.me/bilarius",
      isHighlighted: false,
      openInNewTab: true,
      sortOrder: order++,
    });
  }

  // Footer columns: h3 + links
  $("footer.ftr .grid > div").each((_, col) => {
    const $col = $(col);
    const h3 = $col.find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!h3) return;
    const parentOrder = order++;
    items.push({
      menu: "FOOTER",
      parentLabel: null,
      label: h3,
      url: "#",
      isHighlighted: false,
      openInNewTab: false,
      sortOrder: parentOrder,
    });
    let childOrder = 0;
    $col.find("a").each((_, a) => {
      const $a = $(a);
      items.push({
        menu: "FOOTER",
        parentLabel: h3,
        label: $a.text().replace(/\s+/g, " ").trim(),
        url: $a.attr("href") || "#",
        isHighlighted: false,
        openInNewTab: ($a.attr("target") || "") === "_blank",
        sortOrder: childOrder++,
      });
    });
  });

  return items;
}
