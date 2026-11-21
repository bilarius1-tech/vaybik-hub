/**
 * Демо-сервисы: vaybik.ru, region.vaybik.ru, chat/lead (не развёрнуты).
 */
import { prisma } from "../src/server/db";

const DEMO = [
  {
    slug: "vaybik-main",
    name: "Вайбик (главная)",
    url: "https://vaybik.ru",
    healthUrl: "https://vaybik.ru",
    description: "Статика leadweb (nginx) — запасной вариант",
    type: "STATIC" as const,
    containerNames: ["vaybik-main"],
    isPublic: true,
    isDeployed: true,
    sortOrder: 1,
    tags: ["hub"],
  },
  {
    slug: "vaybik-site-cms",
    name: "Сайт vaybik.ru (CMS)",
    url: "https://vaybik.ru",
    healthUrl: "https://vaybik.ru/healthz",
    description: "Публичный рендер из БД (cutover ON; site-test — зеркало)",
    type: "DOCKER" as const,
    containerNames: ["vaybik-hub-prod-site-1"],
    isPublic: true,
    isDeployed: true,
    sortOrder: 0,
    tags: ["hub", "cms"],
  },
  {
    slug: "region",
    name: "Region",
    url: "https://region.vaybik.ru",
    healthUrl: "https://region.vaybik.ru",
    description: "Сервис region.vaybik.ru",
    type: "DOCKER" as const,
    containerNames: ["region"],
    isPublic: true,
    isDeployed: true,
    sortOrder: 2,
    tags: ["region"],
  },
  {
    slug: "chat",
    name: "Вайбик Чат",
    url: "https://chat.vaybik.ru",
    healthUrl: null,
    description: "ИИ-чат для клиентов студии",
    type: "DOCKER" as const,
    isPublic: true,
    isDeployed: true,
    isProduct: true,
    manageUrl: "https://chat.vaybik.ru/manage/clients/{externalId}",
    sortOrder: 3,
    tags: ["chat", "product"],
  },
  {
    slug: "design-atlas",
    name: "Дизайн Атлас",
    url: "https://design.vaybik.ru",
    healthUrl: "https://design.vaybik.ru",
    description: "Дизайн-система и примеры сайтов для клиентов",
    type: "EXTERNAL" as const,
    isPublic: true,
    isDeployed: true,
    isProduct: true,
    sortOrder: 4,
    tags: ["design", "product", "atlas"],
  },
  {
    slug: "lead",
    name: "Лиды Профи/YouDo",
    url: "https://lead.vaybik.ru",
    healthUrl: null,
    description:
      "Внутренний сбор заявок с Profi.ru и YouDo в Telegram",
    type: "DOCKER" as const,
    isPublic: false,
    isDeployed: false,
    isProduct: false,
    sortOrder: 5,
    tags: ["lead", "studio", "internal"],
  },
];

async function main() {
  for (const s of DEMO) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      create: {
        ...s,
        containerNames: "containerNames" in s ? s.containerNames : [],
        expectedStatus: 200,
        intervalSec: 60,
        timeoutMs: 10000,
        isProduct: "isProduct" in s ? Boolean(s.isProduct) : false,
        manageUrl: "manageUrl" in s ? (s.manageUrl as string) : null,
      },
      update: {
        name: s.name,
        url: s.url,
        healthUrl: s.healthUrl,
        description: s.description,
        isPublic: s.isPublic,
        isDeployed: s.isDeployed,
        sortOrder: s.sortOrder,
        tags: s.tags,
        type: s.type,
        ...("isProduct" in s ? { isProduct: Boolean(s.isProduct) } : {}),
        // manageUrl не трогаем здесь — см. seed:chat-product (не перетирает ручное)
        ...("containerNames" in s
          ? { containerNames: s.containerNames }
          : {}),
      },
    });
    console.log(`✓ ${s.slug}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
