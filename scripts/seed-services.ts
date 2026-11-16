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
    description: "Публичная заглушка хаба",
    type: "STATIC" as const,
    isPublic: true,
    isDeployed: true,
    sortOrder: 1,
    tags: ["hub"],
  },
  {
    slug: "region",
    name: "Region",
    url: "https://region.vaybik.ru",
    healthUrl: "https://region.vaybik.ru",
    description: "Сервис region.vaybik.ru",
    type: "DOCKER" as const,
    isPublic: true,
    isDeployed: true,
    sortOrder: 2,
    tags: ["region"],
  },
  {
    slug: "chat",
    name: "Chat",
    url: "https://chat.vaybik.ru",
    healthUrl: null,
    description: "Чат — ещё не развёрнут",
    type: "DOCKER" as const,
    isPublic: true,
    isDeployed: false,
    sortOrder: 3,
    tags: ["chat", "undeployed"],
  },
  {
    slug: "lead",
    name: "Lead",
    url: "https://lead.vaybik.ru",
    healthUrl: null,
    description: "Лиды / CRM — ещё не развёрнут",
    type: "DOCKER" as const,
    isPublic: true,
    isDeployed: false,
    sortOrder: 4,
    tags: ["lead", "undeployed"],
  },
];

async function main() {
  for (const s of DEMO) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      create: {
        ...s,
        containerNames: [],
        expectedStatus: 200,
        intervalSec: 60,
        timeoutMs: 10000,
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
