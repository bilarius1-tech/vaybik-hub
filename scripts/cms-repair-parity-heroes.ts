#!/usr/bin/env tsx
/**
 * Чинит шаблоны страниц и hero-поля из leadweb HTML (rings/blinds/кнопки/avHero).
 * По умолчанию dry-run. Запись: APPLY=1 npx tsx scripts/cms-repair-parity-heroes.ts
 *
 * Также bump site.contentVersion.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import { recognizeSection } from "../src/server/cms/import/recognize";
import { bumpSiteVersion } from "../src/server/cms/site-version";

const APPLY = process.env.APPLY === "1";
const LEADWEB =
  process.env.LEADWEB_DIR ||
  (existsSync("/opt/vaybik-site-src")
    ? "/opt/vaybik-site-src"
    : path.join(process.cwd(), "../vaybik-site-src"));

/** Как в статике: service-pages.css + body.svc только здесь */
const SERVICE_TEMPLATE = new Set([
  "/avtomatizaciya-1c/",
  "/bitrix/",
]);
const KEYSY_TEMPLATE = new Set(["/keysy-ii/"]);
const HOME_TEMPLATE = new Set(["/"]);
const CALCULATOR_TEMPLATE = new Set(["/kalkulyator/"]);

function templateFor(pagePath: string): string {
  if (HOME_TEMPLATE.has(pagePath)) return "home";
  if (CALCULATOR_TEMPLATE.has(pagePath)) return "calculator";
  if (KEYSY_TEMPLATE.has(pagePath)) return "keysy";
  if (SERVICE_TEMPLATE.has(pagePath)) return "service";
  return "default";
}

function leadwebFile(pagePath: string): string | null {
  if (pagePath === "/") return path.join(LEADWEB, "index.html");
  const p = path.join(LEADWEB, pagePath.replace(/^\//, ""), "index.html");
  return existsSync(p) ? p : null;
}

async function main() {
  const prisma = new PrismaClient();
  const pages = await prisma.page.findMany({
    where: { deletedAt: null, publishedRevisionId: { not: null } },
    select: {
      id: true,
      path: true,
      template: true,
      publishedRevisionId: true,
    },
  });

  let pagesTouched = 0;
  let revsTouched = 0;

  for (const page of pages) {
    const wantTpl = templateFor(page.path);
    if (page.template !== wantTpl) {
      console.log(`template ${page.path}: ${page.template} → ${wantTpl}`);
      pagesTouched += 1;
      if (APPLY) {
        await prisma.page.update({
          where: { id: page.id },
          data: { template: wantTpl as never },
        });
      }
    }

    const file = leadwebFile(page.path);
    if (!file || !page.publishedRevisionId) continue;
    const html = readFileSync(file, "utf8");
    const $ = cheerio.load(html);
    const heroSec = $("section.hero").first();
    if (!heroSec.length) continue;
    const recognized = recognizeSection($, heroSec.get(0)!);
    if (!recognized || recognized.type !== "hero") continue;

    const rev = await prisma.pageRevision.findUnique({
      where: { id: page.publishedRevisionId },
    });
    if (!rev) continue;
    const snap = rev.snapshot as {
      blocks?: Array<{ type: string; data: Record<string, unknown>; anchor?: string | null }>;
    };
    const blocks = [...(snap.blocks || [])];
    const idx = blocks.findIndex((b) => b.type === "hero");
    if (idx < 0) continue;
    const prev = blocks[idx]!;
    const prevData =
      prev.data && typeof prev.data === "object"
        ? (prev.data as Record<string, unknown>)
        : {};
    const heroData =
      recognized.data && typeof recognized.data === "object"
        ? (recognized.data as Record<string, unknown>)
        : {};
    const nextData = {
      ...prevData,
      ...heroData,
    };
    const changed =
      JSON.stringify(prev.data) !== JSON.stringify(nextData) ||
      prev.anchor !== recognized.anchor;
    if (!changed) continue;
    console.log(`hero ${page.path}: patch from ${path.basename(path.dirname(file)) || "index"}`);
    revsTouched += 1;
    blocks[idx] = {
      ...prev,
      data: nextData,
      anchor: recognized.anchor ?? prev.anchor,
    };
    if (APPLY) {
      await prisma.pageRevision.update({
        where: { id: rev.id },
        data: { snapshot: { ...snap, blocks } as object },
      });
    }
  }

  if (APPLY && (pagesTouched || revsTouched)) {
    await bumpSiteVersion(prisma, "repair-parity-heroes");
  }

  console.log(
    APPLY
      ? `Готово: templates ${pagesTouched}, heroes ${revsTouched}`
      : `Dry-run: templates ${pagesTouched}, heroes ${revsTouched}. APPLY=1 для записи.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
