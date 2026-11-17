import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeCmsHtml } from "../sanitize";
import { esc, escAttr } from "./escape";

const CACHE = new Map<string, string>();

function widgetsDir(): string {
  // В образе /app/src/...; локально — от cwd репозитория
  return path.join(
    process.cwd(),
    "src/server/cms/render/widgets",
  );
}

export function loadWidgetPartial(key: string): string | null {
  const file =
    key === "studio"
      ? "studio.html"
      : key === "calcMini"
        ? "calcMini.html"
        : key === "calcFull"
          ? "calcFull.html"
          : null;
  if (!file) return null;
  const cached = CACHE.get(file);
  if (cached != null) return cached;
  try {
    const html = readFileSync(path.join(widgetsDir(), file), "utf8");
    CACHE.set(file, html);
    return html;
  } catch {
    return null;
  }
}

/** Для тестов: сброс кеша партиалов */
export function clearWidgetCache(): void {
  CACHE.clear();
}

export function renderWidgetHtml(
  data: Record<string, unknown>,
  mode: "public" | "preview",
  anchor?: string | null,
): string {
  const key = String(data.key || "studio");
  if (mode === "public") {
    const partial = loadWidgetPartial(key);
    if (partial?.trim()) {
      return partial.trim();
    }
  }
  const snap = sanitizeCmsHtml(String(data.htmlSnapshot || ""));
  const id = anchor || (key === "studio" ? "studio" : "calc-sec");
  if (snap.trim().startsWith("<section")) return snap;
  return `<section class="sec" id="${escAttr(id)}"><div class="w"><div class="widget widget-${escAttr(key)}">${
    snap || `<p class="muted">Виджет «${esc(key)}» (снимок пуст)</p>`
  }</div></div></section>`;
}
