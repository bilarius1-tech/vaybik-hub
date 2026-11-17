import sanitizeHtml from "sanitize-html";

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
  "tabindex",
  "title",
  "data-*",
];

const SVG_ATTRS = [
  "viewBox",
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
  allowProtocolRelative: false,
  // style — запрещён (XSS через expression/url)
  disallowedTagsMode: "discard",
};

/**
 * Санитизация HTML для rawHtml / widget snapshot / SVG-иконок.
 * Убирает script/iframe/on*-атрибуты/javascript:-ссылки и style.
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
  });
}
