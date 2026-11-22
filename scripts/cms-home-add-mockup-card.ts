/**
 * Добавляет 4-ю карточку «Генератор мокапов» в блок «Наши сервисы» на `/`
 * и публикует главную.
 *
 * Картинка: /home/deploy/staging/t45-hub-seo/mockup-card.jpg (или --image=)
 *
 *   npx tsx scripts/cms-home-add-mockup-card.ts --dry-run
 *   npx tsx scripts/cms-home-add-mockup-card.ts
 *   npx tsx scripts/cms-home-add-mockup-card.ts --no-publish
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { parseBlockData } from "../src/server/cms/blocks";
import { processAndCreateAsset } from "../src/server/cms/media/store";
import { syncBlockMediaUsage } from "../src/server/cms/media/sync-usage";
import { publishPage } from "../src/server/cms/service";
import { bumpSiteVersion } from "../src/server/cms/site-version";
import { prisma } from "../src/server/db";

const DRY = process.argv.includes("--dry-run");
const NO_PUBLISH = process.argv.includes("--no-publish");
const imageArg = process.argv.find((a) => a.startsWith("--image="));
const IMAGE_PATH =
  imageArg?.slice("--image=".length) ||
  "/home/deploy/staging/t45-hub-seo/mockup-card.jpg";

const MOCKUP_TITLE = "Генератор мокапов";

type CardItem = {
  title: string;
  textHtml?: string;
  text?: string;
  price?: string | null;
  image?: { mediaId: string | null; src: string | null; alt: string };
  button?: { label: string; href: string; style?: string };
};

async function ensureMockupMedia(): Promise<string> {
  const existing = await prisma.mediaAsset.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { originalName: { startsWith: "mockup-card" } },
        { title: { equals: "service-mockup", mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    console.log(`media уже есть: ${existing.id} (${existing.originalName})`);
    return existing.id;
  }
  const buf = readFileSync(IMAGE_PATH);
  const dto = await processAndCreateAsset({
    buf,
    originalName: path.basename(IMAGE_PATH) || "mockup-card.jpg",
    title: "service-mockup",
    alt: MOCKUP_TITLE,
    tags: ["services", "mockup"],
  });
  console.log(
    `media загружен: ${dto.id} alreadyExists=${Boolean(dto.alreadyExists)}`,
  );
  return dto.id;
}

function defaultThreeCards(): CardItem[] {
  return [
    {
      title: "Консультант на сайт",
      textHtml:
        "<p>ИИ отвечает посетителям по базе знаний 24/7 и передаёт диалог менеджеру в Telegram/MAX.</p>",
      price: "От 1 700 ₽/мес.",
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
      button: {
        label: "Открыть Дизайн Атлас",
        href: "https://design.vaybik.ru",
        style: "primary",
      },
    },
    {
      title: "Лидогенерация",
      textHtml:
        "<p>Собираем заказы с Профи, Юду и Кворк, ИИ отбирает подходящие, заявка приходит в Telegram.</p>",
      price: null,
      button: {
        label: "Подробнее",
        href: "https://lead.vaybik.ru",
        style: "primary",
      },
    },
  ];
}

async function main() {
  const page = await prisma.page.findFirst({
    where: { path: "/", deletedAt: null },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!page) throw new Error("Страница / не найдена");

  const mediaId = DRY ? "dry-media-id" : await ensureMockupMedia();
  const mockupItem: CardItem = {
    title: MOCKUP_TITLE,
    textHtml:
      "<p>Бесплатно, без регистрации: загрузи дизайн и сразу увидишь его на баннере, визитке или телефоне.</p>",
    price: "Бесплатно",
    image: { mediaId, src: null, alt: MOCKUP_TITLE },
    button: {
      label: "Попробовать",
      href: "https://mockup.vaybik.ru",
      style: "primary",
    },
  };

  let block = page.blocks.find((b) => b.type === "serviceCards");
  const studio = page.blocks.find(
    (b) =>
      b.type === "widget" &&
      typeof b.data === "object" &&
      b.data &&
      (b.data as { key?: string }).key === "studio",
  );

  const prev = (block?.data || {}) as {
    header?: unknown;
    background?: string;
    columns?: number;
    items?: CardItem[];
  };
  const items = Array.isArray(prev.items) ? [...prev.items] : defaultThreeCards();
  const idx = items.findIndex((it) => it.title === MOCKUP_TITLE);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...mockupItem, image: mockupItem.image };
    console.log("карточка мокапа уже была — обновим");
  } else {
    items.push(mockupItem);
    console.log("добавляем 4-ю карточку");
  }

  const data = parseBlockData("serviceCards", {
    header: prev.header || { title: "Наши сервисы", kicker: null, subtitle: null },
    background: prev.background || "default",
    // 3 в ряд; 4-я карточка — на второй строке (g3), не g4
    columns: 3,
    items,
  }) as Prisma.InputJsonValue;

  console.log(
    `page=${page.id} block=${block?.id || "new"} items=${items.length} dry=${DRY} publish=${!NO_PUBLISH}`,
  );

  if (DRY) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (studio) {
      await tx.block.delete({ where: { id: studio.id } });
      console.log(`удалён studio ${studio.id}`);
    }
    if (block) {
      await tx.block.update({
        where: { id: block.id },
        data: {
          data,
          anchor: "our-services",
          isHidden: false,
        },
      });
      await syncBlockMediaUsage(tx, {
        pageId: page.id,
        blockId: block.id,
        type: "serviceCards",
        data,
      });
    } else {
      const insertAt = studio?.sortOrder ?? 1;
      await tx.block.updateMany({
        where: { pageId: page.id, sortOrder: { gte: insertAt } },
        data: { sortOrder: { increment: 1 } },
      });
      block = await tx.block.create({
        data: {
          pageId: page.id,
          type: "serviceCards",
          sortOrder: insertAt,
          anchor: "our-services",
          isHidden: false,
          data,
        },
      });
      await syncBlockMediaUsage(tx, {
        pageId: page.id,
        blockId: block.id,
        type: "serviceCards",
        data,
      });
      console.log(`создан serviceCards ${block.id}`);
    }
  });

  if (!NO_PUBLISH) {
    const owner = await prisma.user.findFirst({
      where: { role: "OWNER" },
      select: { id: true },
    });
    const { revision } = await publishPage(
      page.id,
      owner?.id ?? null,
      "4-я карточка: генератор мокапов",
    );
    await bumpSiteVersion(prisma, "cms.home.mockup-card");
    console.log(`опубликовано rev=${revision.id}`);
  } else {
    console.log("без публикации (--no-publish)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
