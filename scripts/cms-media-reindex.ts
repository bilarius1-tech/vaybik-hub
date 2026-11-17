/**
 * Пересобрать MediaUsage по всем блокам.
 * Usage: npx tsx scripts/cms-media-reindex.ts [--dry-run]
 */
import { prisma } from "../src/server/db";
import { collectMediaRefs } from "../src/server/cms/media/usage";

async function main() {
  const dry = process.argv.includes("--dry-run");
  const blocks = await prisma.block.findMany({
    select: { id: true, pageId: true, type: true, data: true },
  });
  let refs = 0;
  const rows: {
    mediaId: string;
    pageId: string;
    blockId: string;
    field: string;
  }[] = [];
  for (const b of blocks) {
    for (const r of collectMediaRefs(b.type, b.data)) {
      rows.push({
        mediaId: r.mediaId,
        pageId: b.pageId,
        blockId: b.id,
        field: r.field,
      });
      refs += 1;
    }
  }
  const mediaIds = [...new Set(rows.map((r) => r.mediaId))];
  const existing = mediaIds.length
    ? await prisma.mediaAsset.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true },
      })
    : [];
  const ok = new Set(existing.map((e) => e.id));
  const filtered = rows.filter((r) => ok.has(r.mediaId));
  const skipped = rows.length - filtered.length;

  console.log(
    JSON.stringify(
      {
        dryRun: dry,
        blocks: blocks.length,
        refsFound: refs,
        refsValid: filtered.length,
        refsSkippedMissingMedia: skipped,
      },
      null,
      2,
    ),
  );

  if (dry) return;

  await prisma.$transaction(async (tx) => {
    await tx.mediaUsage.deleteMany({ where: { revisionId: null } });
    if (filtered.length) {
      await tx.mediaUsage.createMany({ data: filtered });
    }
  });
  console.log("MediaUsage пересобран");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
