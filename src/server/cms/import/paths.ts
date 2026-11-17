import { existsSync } from "node:fs";
import { join } from "node:path";

/** URL из sitemap → относительный путь файла в leadweb */
export function urlToFilePath(srcRoot: string, urlPath: string): string | null {
  let p = urlPath;
  try {
    if (urlPath.startsWith("http")) {
      p = new URL(urlPath).pathname;
    }
  } catch {
    return null;
  }
  if (!p.startsWith("/")) p = `/${p}`;
  if (p === "/") {
    const f = join(srcRoot, "index.html");
    return existsSync(f) ? f : null;
  }
  const trimmed = p.replace(/\/$/, "");
  const candidates = [
    join(srcRoot, trimmed.slice(1), "index.html"),
    join(srcRoot, `${trimmed.slice(1)}.html`),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export function normalizeSitePath(urlOrPath: string): string {
  let p = urlOrPath;
  try {
    if (urlOrPath.startsWith("http")) p = new URL(urlOrPath).pathname;
  } catch {
    /* keep */
  }
  if (!p.startsWith("/")) p = `/${p}`;
  if (p !== "/" && !p.endsWith("/")) p = `${p}/`;
  return p;
}

export const SKIP_PATHS = new Set([
  "/kontakty/",
  "/kontakty",
  "/kp/",
  "/kp",
  "/studio-preview.html",
  "/404.html",
  "/404/",
]);
