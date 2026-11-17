export function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escAttr(s: string | null | undefined): string {
  return esc(s);
}

/** Простой markdown → HTML (жирный, курсив, ссылки, абзацы, списки) */
export function simpleMarkdown(md: string): string {
  if (!md) return "";
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  for (const line of lines) {
    const li = line.match(/^\s*[-*]\s+(.+)$/);
    if (li) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineMd(li[1])}</li>`);
      continue;
    }
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (!line.trim()) continue;
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

function inlineMd(s: string): string {
  let t = esc(s);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t;
}
