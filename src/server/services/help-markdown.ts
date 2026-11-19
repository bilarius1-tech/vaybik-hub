import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Теги для студийной справки (GFM: таблицы, код, заголовки). Без script/iframe. */
const HELP_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "strong",
  "em",
  "del",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

marked.setOptions({ gfm: true, breaks: false });

/**
 * Markdown → безопасный HTML. Сырой HTML из MD не доверяем — только через sanitize.
 */
export function helpMarkdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  const raw = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(raw, {
    allowedTags: HELP_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      code: ["class"],
      pre: ["class"],
      th: ["align"],
      td: ["align"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attribs) => {
        const href = attribs.href || "";
        if (!/^(https?:|mailto:|\/)/i.test(href)) {
          return { tagName: "span", attribs: {} };
        }
        return {
          tagName: "a",
          attribs: {
            href,
            ...(attribs.title ? { title: attribs.title } : {}),
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
    },
  });
}
