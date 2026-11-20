/**
 * Главная `/`: убрать виджет studio (офис), вставить serviceCards на его место.
 * Не публикует — только live-блоки (превью в админке).
 *
 *   npx tsx scripts/cms-home-service-cards.ts           # применить
 *   npx tsx scripts/cms-home-service-cards.ts --dry-run
 *
 * Картинки: ищет MediaAsset по originalName/title:
 *   service-consultant, service-design-system, service-leadgen
 * (с любым расширением). Если нет — карточка без картинки.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { parseBlockData } from "../src/server/cms/blocks";
import { syncBlockMediaUsage } from "../src/server/cms/media/sync-usage";

const DRY = process.argv.includes("--dry-run");

const MEDIA_KEYS = [
  "service-consultant",
  "service-design-system",
  "service-leadgen",
] as const;

async function findMediaId(
  prisma: PrismaClient,
  key: string,
): Promise<string | null> {
  const row = await prisma.mediaAsset.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { originalName: { startsWith: key } },
        { title: { equals: key, mode: "insensitive" } },
        { originalName: { contains: key, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, originalName: true, title: true },
  });
  if (row) {
    console.log(`  media ${key} → ${row.id} (${row.title || row.originalName})`);
  } else {
    console.log(`  media ${key} → не найдено (карточка без картинки)`);
  }
  return row?.id ?? null;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const page = await prisma.page.findFirst({
      where: { path: "/", deletedAt: null },
      include: {
        blocks: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!page) throw new Error("Страница / не найдена");

    console.log(`page ${page.id} blocks=${page.blocks.length} dry=${DRY}`);

    const studio = page.blocks.find(
      (b) =>
        b.type === "widget" &&
        typeof b.data === "object" &&
        b.data &&
        (b.data as { key?: string }).key === "studio",
    );
    if (!studio) {
      console.log("Виджет studio на главной не найден (уже убран?).");
    } else {
      console.log(
        `studio block ${studio.id} sortOrder=${studio.sortOrder} → удалить`,
      );
    }

    const existing = page.blocks.find((b) => b.type === "serviceCards");
    if (existing) {
      console.log(`serviceCards уже есть: ${existing.id} — обновим данные`);
    }

    const mediaIds: Record<(typeof MEDIA_KEYS)[number], string | null> = {
      "service-consultant": null,
      "service-design-system": null,
      "service-leadgen": null,
    };
    for (const key of MEDIA_KEYS) {
      mediaIds[key] = await findMediaId(prisma, key);
    }

    const img = (key: (typeof MEDIA_KEYS)[number], alt: string) =>
      mediaIds[key]
        ? { mediaId: mediaIds[key], src: null, alt }
        : { mediaId: null, src: null, alt };

    const data = parseBlockData("serviceCards", {
      header: { title: "Наши сервисы", kicker: null, subtitle: null },
      background: "default",
      columns: 3,
      items: [
        {
          title: "Консультант на сайт",
          textHtml:
            "<p>ИИ отвечает посетителям по базе знаний 24/7 и передаёт диалог менеджеру в Telegram/MAX.</p>",
          price: "От 1 700 ₽/мес.",
          image: img("service-consultant", "Консультант на сайт"),
          button: {
            label: "Попробовать",
            href: "https://chat.vaybik.ru",
            style: "primary",
          },
        },
        {
          title: "Дизайн-система для ИИ",
          textHtml:
            "<p>Стили для ИИ-агентов: выбираешь стиль, отдаёшь агенту, получаешь разработку в этом стиле.</p>",
          price: null,
          image: img("service-design-system", "Дизайн-система для ИИ"),
          button: {
            label: "Подробнее",
            href: "#contact",
            style: "secondary",
          },
        },
        {
          title: "Лидогенерация",
          textHtml:
            "<p>Собираем заказы с Профи, Юду и Кворк, ИИ отбирает подходящие, заявка приходит в Telegram.</p>",
          price: null,
          image: img("service-leadgen", "Лидогенерация"),
          button: {
            label: "Подробнее",
            href: "#contact",
            style: "secondary",
          },
        },
      ],
    }) as Prisma.InputJsonValue;

    const insertAt = studio?.sortOrder ?? 1;

    if (DRY) {
      console.log("dry-run: изменений нет");
      console.log(JSON.stringify({ insertAt, data }, null, 2));
      return;
    }

    let blockId: string | null = existing?.id ?? null;

    await prisma.$transaction(async (tx) => {
      if (studio) {
        await tx.block.delete({ where: { id: studio.id } });
      }
      if (existing) {
        await tx.block.update({
          where: { id: existing.id },
          data: {
            data,
            anchor: "our-services",
            sortOrder: insertAt,
            isHidden: false,
          },
        });
        await syncBlockMediaUsage(tx, {
          pageId: page.id,
          blockId: existing.id,
          type: "serviceCards",
          data,
        });
      } else {
        await tx.block.updateMany({
          where: { pageId: page.id, sortOrder: { gte: insertAt } },
          data: { sortOrder: { increment: 1 } },
        });
        const created = await tx.block.create({
          data: {
            pageId: page.id,
            type: "serviceCards",
            sortOrder: insertAt,
            anchor: "our-services",
            isHidden: false,
            data,
          },
        });
        blockId = created.id;
        await syncBlockMediaUsage(tx, {
          pageId: page.id,
          blockId: created.id,
          type: "serviceCards",
          data,
        });
      }
    });

    // live-блоки; публичная ревизия не меняется — студия на проде до «Опубликовать»
    console.log(
      "Готово. Превью в админке; публичный сайт без изменений до «Опубликовать».",
    );
    console.log(`serviceCards block: ${blockId}`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
