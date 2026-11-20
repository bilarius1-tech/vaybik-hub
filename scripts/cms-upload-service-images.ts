/**
 * Загрузка трёх картинок сервисов в медиатеку.
 *
 *   npx tsx scripts/cms-upload-service-images.ts /path/to/dir
 *
 * Ожидает файлы:
 *   service-consultant.jpg|.png|.webp
 *   service-design-system.*
 *   service-leadgen.*
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { processAndCreateAsset } from "../src/server/cms/media/store";
import { prisma } from "../src/server/db";

const KEYS = [
  {
    key: "service-consultant",
    title: "service-consultant",
    alt: "Консультант на сайт",
  },
  {
    key: "service-design-system",
    title: "service-design-system",
    alt: "Дизайн-система для ИИ",
  },
  {
    key: "service-leadgen",
    title: "service-leadgen",
    alt: "Лидогенерация",
  },
] as const;

function findFile(dir: string, key: string): string | null {
  const files = readdirSync(dir);
  const hit = files.find((f) => {
    const base = f.toLowerCase();
    return (
      base === key ||
      base.startsWith(`${key}.`) ||
      base.startsWith(`${key}-`)
    );
  });
  return hit ? path.join(dir, hit) : null;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Укажите каталог с файлами");
    process.exit(2);
  }

  for (const item of KEYS) {
    const file = findFile(dir, item.key);
    if (!file) {
      console.error(`нет файла для ${item.key} в ${dir}`);
      process.exit(1);
    }
    const buf = readFileSync(file);
    const originalName = path.basename(file);
    const asset = await processAndCreateAsset({
      buf,
      originalName,
      title: item.title,
      alt: item.alt,
      tags: ["services", item.key],
    });
    console.log(
      `${item.key} → ${asset.id} v${asset.version}` +
        ((asset as { alreadyExists?: boolean }).alreadyExists
          ? " (уже был)"
          : ""),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
