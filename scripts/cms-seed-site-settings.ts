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

/** Disallow /admin/ в каждом блоке Allow — иначе боты со своим User-agent игнорят общий * */
export const DEFAULT_SITE_ROBOTS = `User-agent: GPTBot
Allow: /
Disallow: /admin/

User-agent: OAI-SearchBot
Allow: /
Disallow: /admin/

User-agent: ChatGPT-User
Allow: /
Disallow: /admin/

User-agent: ClaudeBot
Allow: /
Disallow: /admin/

User-agent: Claude-Web
Allow: /
Disallow: /admin/

User-agent: anthropic-ai
Allow: /
Disallow: /admin/

User-agent: PerplexityBot
Allow: /
Disallow: /admin/

User-agent: Google-Extended
Allow: /
Disallow: /admin/

User-agent: Googlebot
Allow: /
Disallow: /admin/

User-agent: Bingbot
Allow: /
Disallow: /admin/

User-agent: YandexBot
Allow: /
Disallow: /admin/

User-agent: YandexAdditional
Allow: /
Disallow: /admin/

User-agent: Applebot-Extended
Allow: /
Disallow: /admin/

User-agent: CCBot
Allow: /
Disallow: /admin/

User-agent: *
Allow: /
Disallow: /admin/

Sitemap: https://vaybik.ru/sitemap.xml
`;

async function main() {
  const robotsPath =
    process.env.SITE_ROBOTS_SRC || "/opt/vaybik-site-src/robots.txt";
  let robots = "";
  try {
    robots = readFileSync(robotsPath, "utf8");
  } catch {
    robots = DEFAULT_SITE_ROBOTS;
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
  console.log("ok");
}

const isDirect =
  process.argv[1]?.includes("cms-seed-site-settings") ||
  process.argv[1]?.endsWith("cms-seed-site-settings.ts");

if (isDirect) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
