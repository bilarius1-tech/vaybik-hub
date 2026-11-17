import type { Prisma } from "@prisma/client";
import { collectMediaRefs } from "./usage";

type Tx = Prisma.TransactionClient;

/** Пересобрать MediaUsage для блока (в той же транзакции, что и сохранение) */
export async function syncBlockMediaUsage(
  tx: Tx,
  opts: {
    pageId: string;
    blockId: string;
    type: string;
    data: unknown;
  },
): Promise<void> {
  await tx.mediaUsage.deleteMany({
    where: { blockId: opts.blockId, revisionId: null },
  });
  const refs = collectMediaRefs(opts.type, opts.data);
  if (refs.length === 0) return;
  // только существующие медиа
  const ids = [...new Set(refs.map((r) => r.mediaId))];
  const existing = await tx.mediaAsset.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true },
  });
  const ok = new Set(existing.map((e) => e.id));
  const rows = refs
    .filter((r) => ok.has(r.mediaId))
    .map((r) => ({
      mediaId: r.mediaId,
      pageId: opts.pageId,
      blockId: opts.blockId,
      field: r.field,
    }));
  if (rows.length) {
    await tx.mediaUsage.createMany({ data: rows });
  }
}

/** MediaUsage для ревизии при публикации */
export async function syncRevisionMediaUsage(
  tx: Tx,
  opts: {
    pageId: string;
    revisionId: string;
    blocks: { id?: string; type: string; data: unknown }[];
  },
): Promise<void> {
  await tx.mediaUsage.deleteMany({
    where: { revisionId: opts.revisionId },
  });
  const rows: {
    mediaId: string;
    pageId: string;
    blockId?: string;
    revisionId: string;
    field: string;
  }[] = [];
  for (const b of opts.blocks) {
    for (const r of collectMediaRefs(b.type, b.data)) {
      rows.push({
        mediaId: r.mediaId,
        pageId: opts.pageId,
        blockId: b.id,
        revisionId: opts.revisionId,
        field: r.field,
      });
    }
  }
  if (!rows.length) return;
  const ids = [...new Set(rows.map((r) => r.mediaId))];
  const existing = await tx.mediaAsset.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const ok = new Set(existing.map((e) => e.id));
  const filtered = rows.filter((r) => ok.has(r.mediaId));
  if (filtered.length) {
    await tx.mediaUsage.createMany({ data: filtered });
  }
}
