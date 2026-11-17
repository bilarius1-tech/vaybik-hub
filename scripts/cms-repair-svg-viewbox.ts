#!/usr/bin/env tsx
/**
 * Одноразовый ремонт снимков/иконок в PageRevision: добавить viewBox="0 0 24 24"
 * к &lt;svg&gt; без viewBox (lucide 24×24).
 *
 * По умолчанию — dry-run. Запись:
 *   APPLY=1 npx tsx scripts/cms-repair-svg-viewbox.ts
 *
 * На прод — только после явного «да» Алексея.
 */
import { PrismaClient } from "@prisma/client";
import { fixMissingSvgViewBox } from "../src/server/cms/render/leadweb-icons";

const APPLY = process.env.APPLY === "1";

function walk(value: unknown): { next: unknown; changed: boolean } {
  if (typeof value === "string") {
    if (!/<svg\b/i.test(value)) return { next: value, changed: false };
    const next = fixMissingSvgViewBox(value);
    return { next, changed: next !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((v) => {
      const r = walk(v);
      if (r.changed) changed = true;
      return r.next;
    });
    return { next, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const r = walk(v);
      if (r.changed) changed = true;
      next[k] = r.next;
    }
    return { next, changed };
  }
  return { next: value, changed: false };
}

async function main() {
  const prisma = new PrismaClient();
  const revs = await prisma.pageRevision.findMany({
    select: { id: true, pageId: true, snapshot: true },
  });
  let touched = 0;
  for (const rev of revs) {
    const snap = rev.snapshot as unknown;
    const { next, changed } = walk(snap);
    if (!changed) continue;
    touched += 1;
    console.log(`revision ${rev.id} (page ${rev.pageId}) — нужно обновить`);
    if (APPLY) {
      await prisma.pageRevision.update({
        where: { id: rev.id },
        data: { snapshot: next as object },
      });
    }
  }
  console.log(
    APPLY
      ? `Обновлено ревизий: ${touched}`
      : `Dry-run: ${touched} ревизий с svg без viewBox. APPLY=1 для записи.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
