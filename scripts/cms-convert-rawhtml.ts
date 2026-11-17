/**
 * Конвертация rawHtml → типизированные блоки.
 * npx tsx scripts/cms-convert-rawhtml.ts [--dry-run] [--only=/path/]
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/server/db";
import { convertRawHtmlBlock } from "../src/server/cms/convert-rawhtml";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("-")) {
    return process.argv[i + 1];
  }
  const pref = process.argv.find((a) => a.startsWith(`${name}=`));
  return pref ? pref.slice(name.length + 1) : undefined;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const only = arg("--only");
  const blocks = await prisma.block.findMany({
    where: {
      type: "rawHtml",
      ...(only ? { page: { path: only } } : {}),
    },
    include: { page: { select: { id: true, path: true, title: true } } },
  });

  const report: Array<Record<string, string>> = [];
  let converted = 0;
  let skipped = 0;

  for (const b of blocks) {
    const html = String((b.data as { html?: string }).html || "");
    const result = convertRawHtmlBlock(html);
    if (!result.ok) {
      skipped += 1;
      report.push({
        page: b.page.path,
        block: b.id,
        anchor: b.anchor || "-",
        result: `skip: ${result.reason}`,
      });
      continue;
    }
    report.push({
      page: b.page.path,
      block: b.id,
      anchor: b.anchor || "-",
      result: `rawHtml → ${result.type}`,
    });
    converted += 1;
    if (dry) continue;

    await prisma.$transaction(async (tx) => {
      const page = await tx.page.findUniqueOrThrow({
        where: { id: b.pageId },
        include: { blocks: { orderBy: { sortOrder: "asc" } } },
      });
      await tx.pageRevision.create({
        data: {
          pageId: page.id,
          note: "до конвертации rawHtml",
          snapshot: {
            page: {
              id: page.id,
              path: page.path,
              title: page.title,
              template: page.template,
              status: page.status,
            },
            blocks: page.blocks.map((x) => ({
              id: x.id,
              type: x.type,
              sortOrder: x.sortOrder,
              data: x.data,
              isHidden: x.isHidden,
              anchor: x.anchor,
            })),
          } as Prisma.InputJsonValue,
        },
      });
      await tx.block.update({
        where: { id: b.id },
        data: {
          type: result.type,
          data: result.data as Prisma.InputJsonValue,
          // anchor / isHidden сохраняем
        },
      });
      await tx.page.update({
        where: { id: page.id },
        data: { status: "DRAFT", source: "manual" },
      });
    });
  }

  console.log(
    JSON.stringify(
      { dryRun: dry, total: blocks.length, converted, skipped, report },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
