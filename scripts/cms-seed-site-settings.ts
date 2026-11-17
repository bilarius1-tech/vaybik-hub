#!/usr/bin/env tsx
/**
 * Засев site.robots / site.assets и template=keysy для /keysy-ii/.
 *   npx tsx scripts/cms-seed-site-settings.ts --dry-run
 *   npx tsx scripts/cms-seed-site-settings.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/server/db";
import { DEFAULT_ASSET_VERSIONS } from "../src/server/cms/render/assets";
import { bumpSiteVersion } from "../src/server/cms/site-version";

const dry = process.argv.includes("--dry-run");

async function main() {
  const robotsPath =
    process.env.SITE_ROBOTS_SRC || "/opt/vaybik-site-src/robots.txt";
  let robots = "";
  try {
    robots = readFileSync(robotsPath, "utf8");
  } catch {
    // В контейнере leadweb нет — полный текст с хоста (как в leadweb robots.txt)
    robots = `User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: YandexBot
Allow: /

User-agent: YandexAdditional
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: *
Allow: /
Disallow: /admin/

Sitemap: https://vaybik.ru/sitemap.xml
`;
  }

  console.log(dry ? "[dry-run]" : "[write]");
  console.log("site.robots bytes:", robots.length);
  console.log("site.assets:", DEFAULT_ASSET_VERSIONS);

  const keysy = await prisma.page.findFirst({
    where: { path: "/keysy-ii/", deletedAt: null },
  });
  console.log(
    "keysy page:",
    keysy ? `${keysy.id} template=${keysy.template}` : "not found",
  );

  if (dry) return;

  await prisma.setting.upsert({
    where: { key: "site.robots" },
    create: { key: "site.robots", value: robots },
    update: { value: robots },
  });
  await prisma.setting.upsert({
    where: { key: "site.assets" },
    create: { key: "site.assets", value: DEFAULT_ASSET_VERSIONS },
    update: { value: DEFAULT_ASSET_VERSIONS },
  });
  if (keysy && keysy.template !== "keysy") {
    await prisma.page.update({
      where: { id: keysy.id },
      data: { template: "keysy" },
    });
  }
  await bumpSiteVersion(prisma, "cms.seed-site-settings");
  console.log("done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
