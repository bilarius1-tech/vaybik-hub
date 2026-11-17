/**
 * Публичный site-сервер vaybik.ru (без Next).
 * Бандл: dist/site.cjs → node site.cjs
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { request as httpRequest } from "node:http";
import { loadPublicPageByPath, loadSiteChrome } from "@/server/cms/public/load";
import {
  renderNotFoundDocument,
  renderSiteDocument,
} from "@/server/cms/render/document";
import { assertSafeMediaPath } from "@/server/cms/media/url";
import { mediaVersionDir } from "@/server/cms/media/store";
import { getSiteContentVersion } from "@/server/cms/site-version";
import { ensureAdminDisallow } from "@/server/seo/robots-normalize";
import { buildPublicCmsSitemapXml } from "@/server/seo/sitemap";
import {
  clearAllCache,
  getAnyCached,
  getCached,
  hasAnyCache,
  putCached,
  setCacheDir,
  type CachedPage,
} from "./cache";
import { sitePrisma } from "./db";
import {
  flushRedirectHits,
  loadRedirects,
  locationWithQuery,
  matchRedirect,
  noteRedirectHit,
  type RedirectRule,
} from "./redirects";

function settingText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in (value as object)) {
    return String((value as { text: string }).text);
  }
  return "";
}

const PORT = Number(process.env.SITE_PORT || 3100);
const ASSETS_ORIGIN =
  process.env.SITE_ASSETS_ORIGIN?.replace(/\/$/, "") || "https://vaybik.ru";
const SITE_ORIGIN =
  process.env.SITE_PUBLIC_ORIGIN?.replace(/\/$/, "") || "https://vaybik.ru";
const MEDIA_BASE = "/media";
const PROXY_TARGET = process.env.SITE_STATIC_PROXY || "http://vaybik-main:80";
const CACHE_DIR = process.env.SITE_CACHE_DIR || "/app/site-cache";

setCacheDir(CACHE_DIR);

let contentVersion = 0;
let dbOk = true;
let redirects: RedirectRule[] = [];
let robotsText = "";
let llmsText = "";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Vaybik-Site": "cms",
  "Content-Security-Policy-Report-Only":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://mc.yandex.com https://yastatic.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://mc.yandex.ru https://mc.yandex.com; frame-src https://mc.yandex.ru; report-uri /csp-report",
};

function isTestHost(host: string | undefined): boolean {
  if (!host) return true;
  const h = host.split(":")[0].toLowerCase();
  return h !== "vaybik.ru" && h !== "www.vaybik.ru";
}

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  headers: Record<string, string | number>,
): void {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function sendCached(
  req: IncomingMessage,
  res: ServerResponse,
  entry: CachedPage,
  extra: Record<string, string> = {},
): void {
  if (req.headers["if-none-match"] === entry.etag) {
    send(res, 304, "", {
      ETag: entry.etag,
      "Cache-Control": "no-cache",
      ...extra,
    });
    return;
  }
  const ae = String(req.headers["accept-encoding"] || "");
  let body: Buffer | string = entry.html;
  const headers: Record<string, string | number> = {
    "Content-Type": entry.contentType,
    ETag: entry.etag,
    "Cache-Control": "no-cache",
    ...extra,
  };
  if (ae.includes("br")) {
    body = entry.br;
    headers["Content-Encoding"] = "br";
  } else if (ae.includes("gzip")) {
    body = entry.gzip;
    headers["Content-Encoding"] = "gzip";
  }
  send(res, entry.status, body, headers);
}

async function refreshMeta(): Promise<void> {
  try {
    const [ver, rules, robotsRow, llmsRow] = await Promise.all([
      getSiteContentVersion(sitePrisma),
      loadRedirects(sitePrisma),
      sitePrisma.setting.findUnique({ where: { key: "site.robots" } }),
      sitePrisma.setting.findUnique({ where: { key: "site.llms" } }),
    ]);
    if (ver !== contentVersion) {
      contentVersion = ver;
      clearAllCache();
      console.info("[site] content version →", ver, "cache cleared");
    }
    redirects = rules;
    robotsText = ensureAdminDisallow(settingText(robotsRow?.value));
    llmsText = settingText(llmsRow?.value);
    dbOk = true;
  } catch (err) {
    dbOk = false;
    console.warn("[site] meta refresh failed", err);
  }
}

function looksLikeFile(pathname: string): boolean {
  const base = pathname.split("/").pop() || "";
  return base.includes(".") && !base.endsWith(".");
}

async function proxyStatic(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  search: string,
  htmlFallback404: boolean,
): Promise<void> {
  const url = new URL(pathname + search, PROXY_TARGET);
  await new Promise<void>((resolve) => {
    const preq = httpRequest(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Host: "vaybik.ru",
          "User-Agent": "vaybik-site-proxy",
          Accept: req.headers.accept || "*/*",
        },
        timeout: 8000,
      },
      (pres) => {
        const status = pres.statusCode || 502;
        const ct = String(pres.headers["content-type"] || "");
        if (
          htmlFallback404 &&
          status === 404 &&
          (ct.includes("text/html") || !looksLikeFile(pathname))
        ) {
          pres.resume();
          void serveNotFound(req, res).then(resolve);
          return;
        }
        const headers: Record<string, string | number> = {
          ...SECURITY_HEADERS,
          "X-Vaybik-Site": "proxy",
        };
        for (const h of [
          "content-type",
          "content-length",
          "cache-control",
          "etag",
          "last-modified",
        ]) {
          if (pres.headers[h]) headers[h] = String(pres.headers[h]);
        }
        res.writeHead(status, headers);
        pres.pipe(res);
        pres.on("end", () => resolve());
      },
    );
    preq.on("error", () => {
      if (htmlFallback404) {
        void serveNotFound(req, res).then(resolve);
      } else {
        send(res, 502, "Bad Gateway", { "Content-Type": "text/plain" });
        resolve();
      }
    });
    preq.end();
  });
}

async function serveNotFound(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const host = req.headers.host;
  const test = isTestHost(host);
  const cached = getCached("/__404__", contentVersion) || getAnyCached("/__404__");
  if (cached && !dbOk) {
    sendCached(req, res, cached, test ? { "X-Robots-Tag": "noindex" } : {});
    return;
  }
  try {
    const chrome = await loadSiteChrome(sitePrisma);
    const html = renderNotFoundDocument({
      nav: chrome.nav,
      contacts: chrome.contacts,
      assetsOrigin: ASSETS_ORIGIN,
      siteOrigin: SITE_ORIGIN,
      assetVersions: chrome.assetVersions,
    });
    const entry = putCached("/__404__", contentVersion, html, 404);
    sendCached(req, res, entry, test ? { "X-Robots-Tag": "noindex" } : {});
  } catch (err) {
    console.warn("[site] 404 render failed", err);
    const fallback = getAnyCached("/__404__");
    if (fallback) {
      sendCached(req, res, fallback, { "X-Robots-Tag": "noindex" });
      return;
    }
    send(res, 404, "Not Found", { "Content-Type": "text/plain" });
  }
}

async function serveMedia(
  res: ServerResponse,
  id: string,
  version: string,
  file: string,
): Promise<void> {
  try {
    const safe = assertSafeMediaPath(id, version, file);
    const filePath = path.join(
      mediaVersionDir(safe.id, safe.version),
      safe.file,
    );
    const buf = await readFile(filePath);
    const ext = path.extname(safe.file).toLowerCase();
    const mime: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".avif": "image/avif",
    };
    const headers: Record<string, string> = {
      ...SECURITY_HEADERS,
      "Content-Type": mime[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (ext === ".svg") {
      headers["Content-Security-Policy"] =
        "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    }
    send(res, 200, buf, headers);
  } catch {
    send(res, 404, "Not Found", { "Content-Type": "text/plain" });
  }
}

async function servePage(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<void> {
  const host = req.headers.host;
  const test = isTestHost(host);
  const extra: Record<string, string> = test
    ? { "X-Robots-Tag": "noindex" }
    : {};

  const cached = getCached(pathname, contentVersion);
  if (cached) {
    sendCached(req, res, cached, extra);
    return;
  }

  try {
    const loaded = await loadPublicPageByPath(sitePrisma, pathname, {
      mediaBase: MEDIA_BASE,
      warn: (m) => console.warn("[site]", m),
    });
    if (!loaded) {
      if (looksLikeFile(pathname)) {
        await proxyStatic(req, res, pathname, "", false);
        return;
      }
      await serveNotFound(req, res);
      return;
    }
    // sanity: source must be revision
    if (loaded.source !== "revision") {
      throw new Error("public page must come from revision");
    }
    const html = renderSiteDocument({
      mode: "public",
      title: loaded.page.title,
      path: loaded.page.path,
      template: loaded.page.template,
      blocks: loaded.blocks,
      nav: loaded.nav,
      seo: loaded.seo,
      contacts: loaded.contacts,
      assetsOrigin: ASSETS_ORIGIN,
      siteOrigin: SITE_ORIGIN,
      assetVersions: loaded.assetVersions,
      media: loaded.media,
      noindexHost: test,
    });
    const entry = putCached(pathname, contentVersion, html, 200);
    sendCached(req, res, entry, extra);
    dbOk = true;
  } catch (err) {
    dbOk = false;
    console.warn("[site] page render failed, try cache", err);
    const stale = getAnyCached(pathname);
    if (stale) {
      sendCached(req, res, stale, { ...extra, "X-Vaybik-Cache": "stale" });
      return;
    }
    await serveNotFound(req, res);
  }
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const host = req.headers.host;
  const test = isTestHost(host);
  const url = new URL(req.url || "/", `http://${host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const search = url.search;

  // 1. healthz
  if (pathname === "/healthz") {
    if (dbOk || hasAnyCache()) {
      send(res, 200, JSON.stringify({ ok: true, version: contentVersion }), {
        "Content-Type": "application/json",
      });
    } else {
      send(res, 503, JSON.stringify({ ok: false }), {
        "Content-Type": "application/json",
      });
    }
    return;
  }

  // 2. media
  const mediaMatch = pathname.match(/^\/media\/([^/]+)\/(v\d+)\/([^/]+)$/);
  if (mediaMatch) {
    await serveMedia(res, mediaMatch[1], mediaMatch[2], mediaMatch[3]);
    return;
  }

  // 3. sitemap / robots
  if (pathname === "/sitemap.xml") {
    try {
      const xml = await buildPublicCmsSitemapXml(sitePrisma);
      send(res, 200, xml, {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=300",
        ...(test ? { "X-Robots-Tag": "noindex" } : {}),
      });
    } catch {
      send(res, 503, "Sitemap unavailable", { "Content-Type": "text/plain" });
    }
    return;
  }
  if (pathname === "/robots.txt") {
    const body = test
      ? "User-agent: *\nDisallow: /\n"
      : robotsText ||
        ensureAdminDisallow(
          "User-agent: *\nAllow: /\n\nSitemap: https://vaybik.ru/sitemap.xml\n",
        );
    send(res, 200, body, {
      "Content-Type": "text/plain; charset=utf-8",
      ...(test ? { "X-Robots-Tag": "noindex" } : {}),
    });
    return;
  }
  if (pathname === "/llms.txt") {
    const body =
      llmsText ||
      "# vaybik.ru\n\n> Сайт студии Вайбик. Подробности — на https://vaybik.ru/\n";
    send(res, 200, body, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=300",
      ...(test ? { "X-Robots-Tag": "noindex" } : {}),
    });
    return;
  }

  // 4. redirects
  const redir = matchRedirect(pathname, redirects);
  if (redir) {
    noteRedirectHit(redir.id);
    const loc = locationWithQuery(redir.to, search);
    send(res, redir.code, "", { Location: loc });
    return;
  }

  // 5. normalization
  if (pathname.endsWith("/index.html")) {
    const target = pathname.replace(/\/index\.html$/, "/") || "/";
    send(res, 301, "", { Location: locationWithQuery(target, search) });
    return;
  }
  if (pathname !== "/" && !pathname.endsWith("/") && !looksLikeFile(pathname)) {
    try {
      const withSlash = `${pathname}/`;
      const exists = await sitePrisma.page.findFirst({
        where: {
          path: withSlash,
          publishedRevisionId: { not: null },
          status: { not: "ARCHIVED" },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (exists) {
        send(res, 301, "", {
          Location: locationWithQuery(withSlash, search),
        });
        return;
      }
    } catch {
      /* continue */
    }
  }

  // 6. CMS page (HTML-пути)
  if (!looksLikeFile(pathname)) {
    await servePage(req, res, pathname);
    return;
  }

  // 7. proxy static / unknown files → nginx
  await proxyStatic(req, res, pathname, search, false);
}

const server = createServer((req, res) => {
  void handle(req, res).catch((err) => {
    console.error("[site] unhandled", err);
    if (!res.headersSent) {
      send(res, 500, "Internal Error", { "Content-Type": "text/plain" });
    }
  });
});

async function main() {
  await refreshMeta();
  setInterval(() => {
    void refreshMeta();
  }, 5000);
  setInterval(() => {
    void flushRedirectHits(sitePrisma);
  }, 60_000);

  server.listen(PORT, "0.0.0.0", () => {
    console.info(
      `[site] listening :${PORT} origin=${SITE_ORIGIN} assets=${ASSETS_ORIGIN} version=${contentVersion}`,
    );
  });
}

void main();
