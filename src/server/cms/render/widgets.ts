import { readFileSync } from "node:fs";
import path from "node:path";
import { sanitizeCmsHtml } from "../sanitize";
import { esc, escAttr } from "./escape";
import { fixMissingSvgViewBox } from "./leadweb-icons";

const CACHE = new Map<string, string>();

function widgetsDir(): string {
  // В образе /app/src/...; локально — от cwd репозитория
  return path.join(process.cwd(), "src/server/cms/render/widgets");
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

/** showMore: явный флаг, иначе по наличию calc-more в снимке (главная да, /uslugi/ нет). */
export function resolveCalcMiniShowMore(data: Record<string, unknown>): boolean {
  if (typeof data.showMore === "boolean") return data.showMore;
  return /calc-more/.test(String(data.htmlSnapshot || ""));
}

function applyCalcMiniShowMore(html: string, showMore: boolean): string {
  if (showMore) return html;
  return html.replace(/<p class="calc-more">[\s\S]*?<\/p>/i, "");
}

export function renderWidgetHtml(
  data: Record<string, unknown>,
  mode: "public" | "preview",
  anchor?: string | null,
): string {
  const key = String(data.key || "studio");
  // studio / calcMini / calcFull — интерактивные шаблоны; снимок sanitize выкидывает form/input/button
  const preferTemplate =
    key === "studio" || key === "calcMini" || key === "calcFull";
  if (preferTemplate && (mode === "public" || mode === "preview")) {
    const partial = loadWidgetPartial(key);
    if (partial?.trim()) {
      let html = partial.trim();
      if (key === "calcMini") {
        html = applyCalcMiniShowMore(html, resolveCalcMiniShowMore(data));
      }
      return fixMissingSvgViewBox(html);
    }
  }
  const snap = sanitizeCmsHtml(String(data.htmlSnapshot || ""));
  if (snap.trim()) {
    const fixed = fixMissingSvgViewBox(snap);
    if (fixed.trim().startsWith("<section")) return fixed;
    const id = anchor || (key === "studio" ? "studio" : "calc-sec");
    return `<section class="sec" id="${escAttr(id)}"><div class="w"><div class="widget widget-${escAttr(key)}">${fixed}</div></div></section>`;
  }
  if (mode === "public" || mode === "preview") {
    const partial = loadWidgetPartial(key);
    if (partial?.trim()) {
      let html = partial.trim();
      if (key === "calcMini") {
        html = applyCalcMiniShowMore(html, resolveCalcMiniShowMore(data));
      }
      return fixMissingSvgViewBox(html);
    }
  }
  const id = anchor || (key === "studio" ? "studio" : "calc-sec");
  return `<section class="sec" id="${escAttr(id)}"><div class="w"><div class="widget widget-${escAttr(key)}"><p class="muted">Виджет «${esc(key)}» (снимок пуст)</p></div></div></section>`;
}
