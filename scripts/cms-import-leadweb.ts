/**
 * Импорт страниц leadweb в CMS хаба.
 * Только читает --src; пишет в БД админки (если не --dry-run).
 *
 * Usage:
 *   npx tsx scripts/cms-import-leadweb.ts [--src /opt/vaybik-site-src] [--dry-run] [--force] [--reset-nav] [--only=/path/]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/server/db";
import { extractNavFromIndex } from "../src/server/cms/import/nav";
import { parseNginxRedirects } from "../src/server/cms/import/nginx-redirects";
import {
  normalizeSitePath,
  SKIP_PATHS,
  urlToFilePath,
} from "../src/server/cms/import/paths";
import { extractMainBlocks } from "../src/server/cms/import/recognize";
import { publishPage } from "../src/server/cms/service";

type ReportPage = {
  path: string;
  status: "created" | "updated" | "skipped" | "error";
  reason?: string;
  blocksByType: Record<string, number>;
  rawHtml: Array<{ id: string | null; className: string; reason?: string }>;
};

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) {
    const next = process.argv[idx + 1];
    if (next && !next.startsWith("--")) return next;
    return "true";
  }
  return fallback;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function parseSitemap(xml: string): string[] {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.map(normalizeSitePath);
}

function templateFor(path: string): string {
  if (path === "/") return "home";
  if (path.startsWith("/kalkulyator")) return "calculator";
  if (path.startsWith("/keysy-ii")) return "keysy";
  // body.svc + service-pages.css только у 1С / Битрикс (leadweb);
  // /uslugi/*, /avtomatizaciya/, /sayt-za-0/ — default
  if (path.startsWith("/avtomatizaciya-") || path.startsWith("/bitrix")) {
    return "service";
  }
  return "default";
}

async function upsertSeo(
  path: string,
  seo: ReturnType<typeof extractMainBlocks>["seo"],
  force: boolean,
): Promise<string> {
  const existing = await prisma.seoPage.findUnique({
    where: { host_path: { host: "vaybik.ru", path } },
  });
  const data = {
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    robots: seo.robots || "index,follow",
    ogTitle: seo.ogTitle,
    ogDescription: seo.ogDescription,
    ogImage: seo.ogImage,
    twitterCard: seo.twitterCard,
    jsonLd: (seo.jsonLd as Prisma.InputJsonValue) ?? undefined,
    inSitemap: true,
  };
  if (!existing) {
    const created = await prisma.seoPage.create({
      data: { host: "vaybik.ru", path, ...data },
    });
    return created.id;
  }
  if (force) {
    await prisma.seoPage.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  // заполнять только пустые поля
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null || v === "") continue;
    const cur = (existing as Record<string, unknown>)[k];
    if (cur == null || cur === "") patch[k] = v;
  }
  if (Object.keys(patch).length) {
    await prisma.seoPage.update({ where: { id: existing.id }, data: patch });
  }
  return existing.id;
}

async function main() {
  const src = arg("src", "/opt/vaybik-site-src")!;
  const dryRun = arg("dry-run") === "true";
  const force = arg("force") === "true";
  const resetNav = arg("reset-nav") === "true";
  const only = arg("only");

  if (!existsSync(src)) {
    console.error(`Источник не найден: ${src}`);
    process.exit(1);
  }

  const sitemapPath = join(src, "sitemap.xml");
  const sitemap = readFileSync(sitemapPath, "utf8");
  let paths = parseSitemap(sitemap);
  const skipped: string[] = [];

  // явно перечислить пропускаемые
  for (const s of [
    "/kontakty/",
    "/kp/",
    "/studio-preview.html",
    "/404.html",
  ]) {
    skipped.push(`${s} (не в sitemap / служебная)`);
  }

  if (only) {
    paths = paths.filter((p) => p === normalizeSitePath(only));
  }

  const report: {
    pages: ReportPage[];
    nav: { created: number; updated: number; skipped: number };
    redirects: { created: number; updated: number; skipped: number };
    skipped: string[];
    totals: Record<string, number>;
  } = {
    pages: [],
    nav: { created: 0, updated: 0, skipped: 0 },
    redirects: { created: 0, updated: 0, skipped: 0 },
    skipped,
    totals: { pages: 0, blocks: 0, nav: 0, redirects: 0 },
  };

  const pathToPageId = new Map<string, string>();

  for (const path of paths) {
    if (SKIP_PATHS.has(path) || SKIP_PATHS.has(path.replace(/\/$/, ""))) {
      report.pages.push({
        path,
        status: "skipped",
        reason: "в списке пропусков",
        blocksByType: {},
        rawHtml: [],
      });
      continue;
    }
    const file = urlToFilePath(src, path);
    if (!file) {
      report.pages.push({
        path,
        status: "error",
        reason: "файл не найден",
        blocksByType: {},
        rawHtml: [],
      });
      continue;
    }

    const html = readFileSync(file, "utf8");
    const hash = sha256(html);
    const { blocks, seo, rawHtmlCount } = extractMainBlocks(html);
    const blocksByType: Record<string, number> = {};
    const rawHtml: ReportPage["rawHtml"] = [];
    for (const b of blocks) {
      blocksByType[b.type] = (blocksByType[b.type] || 0) + 1;
      if (b.type === "rawHtml") {
        rawHtml.push({
          id: b.anchor,
          className: "",
          reason: b.reason,
        });
      }
    }

    const existing = await prisma.page.findFirst({
      where: { path, deletedAt: null },
      include: { revisions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (existing) {
      if (existing.importHash === hash && !force) {
        report.pages.push({
          path,
          status: "skipped",
          reason: "importHash совпал",
          blocksByType,
          rawHtml,
        });
        pathToPageId.set(path, existing.id);
        continue;
      }
      if (
        !force &&
        (existing.source === "manual" ||
          (existing.revisions.length > 0 &&
            existing.revisions[0]?.note &&
            !existing.revisions[0].note.startsWith("импорт из leadweb")))
      ) {
        report.pages.push({
          path,
          status: "skipped",
          reason: "страница правилась в админке (нужен --force)",
          blocksByType,
          rawHtml,
        });
        pathToPageId.set(path, existing.id);
        continue;
      }
    }

    if (dryRun) {
      report.pages.push({
        path,
        status: existing ? "updated" : "created",
        reason: `dry-run; блоков ${blocks.length}, rawHtml ${rawHtmlCount}`,
        blocksByType,
        rawHtml,
      });
      report.totals.pages += 1;
      report.totals.blocks += blocks.length;
      continue;
    }

    const seoPageId = await upsertSeo(path, seo, force);
    const title =
      seo.title?.split("|")[0]?.trim() ||
      seo.ogTitle ||
      path;

    let pageId: string;
    if (existing) {
      await prisma.block.deleteMany({ where: { pageId: existing.id } });
      const updated = await prisma.page.update({
        where: { id: existing.id },
        data: {
          title,
          template: templateFor(path),
          importHash: hash,
          source: "import",
          seoPageId,
          status: "DRAFT",
        },
      });
      pageId = updated.id;
    } else {
      const created = await prisma.page.create({
        data: {
          path,
          title,
          template: templateFor(path),
          importHash: hash,
          source: "import",
          seoPageId,
          status: "DRAFT",
        },
      });
      pageId = created.id;
    }

    let sortOrder = 0;
    for (const b of blocks) {
      await prisma.block.create({
        data: {
          pageId,
          type: b.type,
          sortOrder: sortOrder++,
          data: b.data as Prisma.InputJsonValue,
          anchor: b.anchor,
        },
      });
    }

    const leadwebSha = sha256(html).slice(0, 12);
    await publishPage(pageId, null, `импорт из leadweb ${leadwebSha}`);

    pathToPageId.set(path, pageId);
    report.pages.push({
      path,
      status: existing ? "updated" : "created",
      blocksByType,
      rawHtml,
    });
    report.totals.pages += 1;
    report.totals.blocks += blocks.length;
  }

  // --- redirects ---
  const nginxPath = join(src, "nginx.conf");
  if (existsSync(nginxPath)) {
    const redirects = parseNginxRedirects(readFileSync(nginxPath, "utf8"));
    // гарантированные из ТЗ (если парсер что-то пропустил)
    const ensure: typeof redirects = [
      {
        fromPath: "/automation.html",
        toPath: "/avtomatizaciya-1c/",
        code: 301,
        match: "EXACT",
      },
      {
        fromPath: "/bitrix.html",
        toPath: "/bitrix/",
        code: 301,
        match: "EXACT",
      },
      { fromPath: "/kontakty", toPath: "/o-nas/", code: 301, match: "EXACT" },
      { fromPath: "/kontakty/", toPath: "/o-nas/", code: 301, match: "EXACT" },
      { fromPath: "/leadweb", toPath: "/", code: 301, match: "EXACT" },
      { fromPath: "/leadweb/", toPath: "/", code: 301, match: "PREFIX" },
    ];
    const byFrom = new Map<string, (typeof redirects)[0]>();
    for (const r of [...redirects, ...ensure]) byFrom.set(r.fromPath, r);

    for (const r of byFrom.values()) {
      const existing = await prisma.redirect.findUnique({
        where: { fromPath: r.fromPath },
      });
      if (dryRun) {
        if (existing) report.redirects.skipped += 1;
        else report.redirects.created += 1;
        report.totals.redirects += 1;
        continue;
      }
      if (existing && !force) {
        report.redirects.skipped += 1;
        continue;
      }
      if (existing) {
        await prisma.redirect.update({
          where: { id: existing.id },
          data: {
            toPath: r.toPath,
            code: r.code,
            match: r.match,
            source: "import",
            isActive: true,
            note: r.note || "import leadweb",
          },
        });
        report.redirects.updated += 1;
      } else {
        await prisma.redirect.create({
          data: {
            fromPath: r.fromPath,
            toPath: r.toPath,
            code: r.code,
            match: r.match,
            source: "import",
            note: r.note || "import leadweb",
          },
        });
        report.redirects.created += 1;
      }
      report.totals.redirects += 1;
    }
  }

  // --- nav from index.html ---
  const indexFile = join(src, "index.html");
  if (existsSync(indexFile)) {
    const navItems = extractNavFromIndex(readFileSync(indexFile, "utf8"));

    async function resolvePageId(url: string): Promise<string | null> {
      if (!url.startsWith("/") || url.startsWith("//")) return null;
      const pathOnly = normalizeSitePath(url.split("#")[0] || url);
      if (url.includes("#")) return null; // якоря — через url
      return pathToPageId.get(pathOnly) ||
        (
          await prisma.page.findFirst({
            where: { path: pathOnly, deletedAt: null },
            select: { id: true },
          })
        )?.id ||
        null;
    }

    if (!dryRun) {
      // идемпотентно: очищаем только import-меню? Проще upsert по (menu,parent,label)
      // Меню: пустое → создать; пересоздать только с --reset-nav (не с --force)
      const count = await prisma.navItem.count();
      if (count === 0 || resetNav) {
        if (resetNav) await prisma.navItem.deleteMany();
        const parentIds = new Map<string, string>();
        for (const item of navItems.filter((n) => !n.parentLabel)) {
          const pageId = await resolvePageId(item.url);
          const created = await prisma.navItem.create({
            data: {
              menu: item.menu,
              label: item.label,
              url: pageId ? null : item.url,
              pageId,
              sortOrder: item.sortOrder,
              isHighlighted: item.isHighlighted,
              openInNewTab: item.openInNewTab,
            },
          });
          parentIds.set(`${item.menu}:${item.label}`, created.id);
          report.nav.created += 1;
          report.totals.nav += 1;
        }
        for (const item of navItems.filter((n) => n.parentLabel)) {
          const parentId = parentIds.get(`${item.menu}:${item.parentLabel}`);
          if (!parentId) continue;
          const pageId = await resolvePageId(item.url);
          await prisma.navItem.create({
            data: {
              menu: item.menu,
              parentId,
              label: item.label,
              url: pageId ? null : item.url,
              pageId,
              sortOrder: item.sortOrder,
              isHighlighted: item.isHighlighted,
              openInNewTab: item.openInNewTab,
            },
          });
          report.nav.created += 1;
          report.totals.nav += 1;
        }
      } else {
        report.nav.skipped = navItems.length;
      }
    } else {
      report.nav.created = navItems.length;
      report.totals.nav = navItems.length;
    }
  }

  const outPath = `/tmp/cms-import-leadweb-${Date.now()}.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nОтчёт: ${outPath}`);
  console.log(
    dryRun
      ? "DRY-RUN: в БД ничего не записано"
      : `Готово: страниц ${report.totals.pages}, блоков ${report.totals.blocks}, меню ${report.totals.nav}, редиректов ${report.totals.redirects}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
