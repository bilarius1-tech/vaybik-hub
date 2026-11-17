import sanitizeHtml from "sanitize-html";
import type { RichTextPreset } from "@/lib/cms-richtext";

export type { RichTextPreset };

/** SVG-теги, которые встречаются в lucide-подобных иконках leadweb */
const SVG_TAGS = [
  "svg",
  "g",
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "ellipse",
  "defs",
  "clipPath",
  "use",
  "symbol",
  "title",
  "desc",
  "text",
  "tspan",
];

const COMMON_ATTRS = [
  "class",
  "id",
  "role",
  "aria-hidden",
  "aria-label",
  "aria-labelledby",
  "aria-current",
  "tabindex",
  "title",
  "data-*",
  // безопасные инлайны leadweb (margin-top на .lead.reveal и т.п.)
  "style",
];

/** Только безопасные CSS-свойства — без url()/expression/behavior. */
const LENGTH = [/^\d*\.?\d+(px|em|rem|%)$/];
const SAFE_STYLES: NonNullable<sanitizeHtml.IOptions["allowedStyles"]> = {
  "*": {
    "margin-top": LENGTH,
    "margin-left": LENGTH,
    "margin-right": LENGTH,
    "margin-bottom": LENGTH,
    "padding-top": LENGTH,
    "font-size": LENGTH,
    "font-weight": [/^\d{1,4}$/, /^(normal|bold)$/],
    "border-radius": LENGTH,
    background: [/^#[0-9a-fA-F]{3,8}$/, /^transparent$/],
    display: [/^(block|inline|inline-block|none|flex)$/],
    opacity: [/^\d+(\.\d+)?$/],
  },
};

const SVG_ATTRS = [
  // htmlparser2 по умолчанию lowercases → держим оба варианта в allowlist
  "viewBox",
  "viewbox",
  "preserveAspectRatio",
  "preserveaspectratio",
  "xmlns",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-opacity",
  "fill-opacity",
  "fill-rule",
  "clip-rule",
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "points",
  "transform",
  "width",
  "height",
  "opacity",
  "href",
  "xlink:href",
];

/** Не lowercasить имена атрибутов: иначе viewBox → viewbox и выпадает из allowlist. */
const SVG_PARSER: sanitizeHtml.IOptions["parser"] = {
  lowerCaseAttributeNames: false,
};

const BASE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    ...SVG_TAGS,
    "img",
    "picture",
    "source",
    "figure",
    "figcaption",
    "section",
    "article",
    "header",
    "footer",
    "nav",
    "main",
    "aside",
    "details",
    "summary",
    "dialog",
    "input",
    "label",
    "button",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": [...COMMON_ATTRS],
    a: ["href", "name", "target", "rel", "class", "id", ...COMMON_ATTRS],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading", "class", "id"],
    source: ["src", "srcset", "type", "media"],
    input: [
      "type",
      "name",
      "id",
      "value",
      "checked",
      "class",
      "role",
      "aria-label",
      "aria-hidden",
    ],
    label: ["for", "class", "id", ...COMMON_ATTRS],
    button: [
      "type",
      "class",
      "id",
      "name",
      "value",
      "disabled",
      "data-*",
      ...COMMON_ATTRS,
    ],
    svg: [...SVG_ATTRS, ...COMMON_ATTRS],
    path: [...SVG_ATTRS, ...COMMON_ATTRS],
    g: [...SVG_ATTRS, ...COMMON_ATTRS],
    circle: [...SVG_ATTRS, ...COMMON_ATTRS],
    rect: [...SVG_ATTRS, ...COMMON_ATTRS],
    line: [...SVG_ATTRS, ...COMMON_ATTRS],
    polyline: [...SVG_ATTRS, ...COMMON_ATTRS],
    polygon: [...SVG_ATTRS, ...COMMON_ATTRS],
    ellipse: [...SVG_ATTRS, ...COMMON_ATTRS],
    use: [...SVG_ATTRS, ...COMMON_ATTRS],
    text: [...SVG_ATTRS, ...COMMON_ATTRS],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src", "cite", "xlink:href"],
  allowProtocolRelative: false,
  // style — только SAFE_STYLES (без url()/expression)
  allowedStyles: SAFE_STYLES,
  disallowedTagsMode: "discard",
  parser: SVG_PARSER,
};

const RICH_TAGS: Record<RichTextPreset, string[]> = {
  full: [
    "p",
    "br",
    "strong",
    "em",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h2",
    "h3",
    "h4",
    "hr",
    "img",
  ],
  basic: ["p", "br", "strong", "em", "a", "ul", "ol", "li"],
  inline: ["strong", "em", "a", "br"],
};

/**
 * Санитизация HTML для rawHtml / widget snapshot / SVG-иконок.
 * Убирает script/iframe/on*-атрибуты/javascript:-ссылки;
 * style — только безопасные свойства (margin/font/display/opacity).
 */
export function sanitizeCmsHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, BASE_OPTIONS);
}

/** Узкий санитайзер для инлайн-SVG иконок */
export function sanitizeSvgIcon(svg: string): string {
  if (!svg) return "";
  return sanitizeHtml(svg, {
    ...BASE_OPTIONS,
    allowedTags: SVG_TAGS,
    parser: SVG_PARSER,
  });
}

/**
 * Строгий санитайзер для загружаемых SVG-файлов.
 * Без script/foreignObject/style-элементов/on*; use только href="#…".
 */
export function sanitizeSvgFile(svg: string): string {
  if (!svg) return "";
  return sanitizeHtml(svg, {
    allowedTags: SVG_TAGS.filter((t) => t !== "foreignObject"),
    allowedAttributes: {
      "*": [
        "id",
        "class",
        "fill",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "opacity",
        "transform",
        "viewBox",
        "viewbox",
        "preserveAspectRatio",
        "preserveaspectratio",
        "xmlns",
        "width",
        "height",
        "d",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "points",
        "fill-rule",
        "clip-rule",
      ],
      use: ["href", "xlink:href", "width", "height", "x", "y"],
      a: ["href"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesAppliedToAttributes: ["href", "xlink:href"],
    parser: SVG_PARSER,
    transformTags: {
      use: (tagName, attribs) => {
        const href = attribs.href || attribs["xlink:href"] || "";
        if (!href.startsWith("#")) {
          const { href: _h, "xlink:href": _x, ...rest } = attribs;
          void _h;
          void _x;
          return { tagName, attribs: rest };
        }
        return { tagName, attribs: { ...attribs, href } };
      },
    },
    disallowedTagsMode: "discard",
  });
}

function transformRichLink(
  _tagName: string,
  attribs: Record<string, string>,
): sanitizeHtml.Tag {
  const href = attribs.href || "";
  const ok =
    /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href) &&
    !/^(javascript:|data:)/i.test(href);
  if (!ok) {
    return { tagName: "span", attribs: {} };
  }
  const out: Record<string, string> = { href };
  if (attribs.target === "_blank") {
    out.target = "_blank";
    const rel = new Set(
      (attribs.rel || "").split(/\s+/).filter(Boolean).concat(["noopener", "noreferrer"]),
    );
    if (attribs["data-nofollow"] === "1" || /\bnofollow\b/.test(attribs.rel || "")) {
      rel.add("nofollow");
    }
    out.rel = [...rel].join(" ");
  } else if (attribs.rel) {
    out.rel = attribs.rel;
  }
  return { tagName: "a", attribs: out };
}

/** Санитайзер rich text по пресету Tiptap (хранение — HTML-строка) */
export function sanitizeRichText(
  html: string,
  preset: RichTextPreset = "basic",
): string {
  if (!html) return "";
  const tags = RICH_TAGS[preset];
  return sanitizeHtml(html, {
    allowedTags: tags,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading", "data-media-id"],
      p: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      // leadweb использует <b>/<i> — сохраняем как strong/em, иначе слова склеиваются
      b: "strong",
      i: "em",
      a: transformRichLink,
      img: (tagName, attribs) => {
        const mediaId = attribs["data-media-id"];
        if (!mediaId) {
          // без mediaId — оставляем только безопасный относительный/https src
          const src = attribs.src || "";
          if (!/^(https:\/\/|\/)/i.test(src) || /^(javascript:|data:)/i.test(src)) {
            return { tagName: "span", attribs: {} };
          }
        }
        return {
          tagName,
          attribs: {
            ...(mediaId ? { "data-media-id": mediaId } : {}),
            ...(attribs.src ? { src: attribs.src } : {}),
            ...(attribs.alt != null ? { alt: attribs.alt } : { alt: "" }),
            ...(attribs.width ? { width: attribs.width } : {}),
            ...(attribs.height ? { height: attribs.height } : {}),
            loading: "lazy",
          },
        };
      },
    },
    disallowedTagsMode: "discard",
  });
}
