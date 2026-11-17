import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

export type CachedPage = {
  html: string;
  gzip: Buffer;
  br: Buffer;
  etag: string;
  status: number;
  contentType: string;
};

const memory = new Map<string, CachedPage>();
let diskDir = process.env.SITE_CACHE_DIR || path.join(process.cwd(), "site-cache");

export function setCacheDir(dir: string): void {
  diskDir = dir;
}

export function cacheKey(pathname: string, version: number): string {
  return `v${version}:${pathname}`;
}

function safeName(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function getCached(pathname: string, version: number): CachedPage | null {
  const key = cacheKey(pathname, version);
  const mem = memory.get(key);
  if (mem) return mem;
  try {
    const base = path.join(diskDir, safeName(key));
    if (!existsSync(`${base}.html`)) return null;
    const html = readFileSync(`${base}.html`, "utf8");
    const meta = JSON.parse(readFileSync(`${base}.json`, "utf8")) as {
      etag: string;
      status: number;
      contentType: string;
    };
    const gzip = readFileSync(`${base}.gz`);
    const br = existsSync(`${base}.br`)
      ? readFileSync(`${base}.br`)
      : brotliCompressSync(Buffer.from(html));
    const entry: CachedPage = {
      html,
      gzip,
      br,
      etag: meta.etag,
      status: meta.status,
      contentType: meta.contentType,
    };
    memory.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

/** Любой кеш для pathname при недоступной БД (последняя известная версия) */
export function getAnyCached(pathname: string): CachedPage | null {
  for (const [key, val] of memory) {
    if (key.endsWith(`:${pathname}`)) return val;
  }
  try {
    if (!existsSync(diskDir)) return null;
    for (const name of readdirSync(diskDir)) {
      if (!name.endsWith(".json")) continue;
      const meta = JSON.parse(
        readFileSync(path.join(diskDir, name), "utf8"),
      ) as { pathname?: string; etag: string; status: number; contentType: string };
      if (meta.pathname !== pathname) continue;
      const base = path.join(diskDir, name.replace(/\.json$/, ""));
      const html = readFileSync(`${base}.html`, "utf8");
      const gzip = readFileSync(`${base}.gz`);
      const br = existsSync(`${base}.br`)
        ? readFileSync(`${base}.br`)
        : brotliCompressSync(Buffer.from(html));
      return {
        html,
        gzip,
        br,
        etag: meta.etag,
        status: meta.status,
        contentType: meta.contentType,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function putCached(
  pathname: string,
  version: number,
  html: string,
  status = 200,
  contentType = "text/html; charset=utf-8",
): CachedPage {
  const buf = Buffer.from(html, "utf8");
  const etag = `"${createHash("sha1").update(buf).digest("hex")}"`;
  const entry: CachedPage = {
    html,
    gzip: gzipSync(buf),
    br: brotliCompressSync(buf),
    etag,
    status,
    contentType,
  };
  const key = cacheKey(pathname, version);
  memory.set(key, entry);
  try {
    mkdirSync(diskDir, { recursive: true });
    const base = path.join(diskDir, safeName(key));
    writeFileSync(`${base}.html`, html);
    writeFileSync(`${base}.gz`, entry.gzip);
    writeFileSync(`${base}.br`, entry.br);
    writeFileSync(
      `${base}.json`,
      JSON.stringify({
        pathname,
        version,
        etag,
        status,
        contentType,
      }),
    );
  } catch (err) {
    console.warn("[site-cache] disk write failed", err);
  }
  return entry;
}

export function clearMemoryCache(): void {
  memory.clear();
}

export function clearAllCache(): void {
  memory.clear();
  try {
    mkdirSync(diskDir, { recursive: true });
    // Не rm -rf сам mount-point (EBUSY в Docker) — чистим содержимое.
    for (const name of readdirSync(diskDir)) {
      rmSync(path.join(diskDir, name), { recursive: true, force: true });
    }
  } catch (err) {
    console.warn("[site-cache] clear failed", err);
  }
}

export function hasAnyCache(): boolean {
  if (memory.size > 0) return true;
  try {
    return existsSync(diskDir) && readdirSync(diskDir).length > 0;
  } catch {
    return false;
  }
}
