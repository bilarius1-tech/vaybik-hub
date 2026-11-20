/**
 * Идемпотентно создаёт/обновляет сервис «Дизайн Атлас» (slug=design-atlas).
 * DNS/Traefik не трогаем — только запись в реестре хаба.
 */
import { prisma } from "../src/server/db";

const DATA = {
  slug: "design-atlas",
  name: "Дизайн Атлас",
  url: "https://design.vaybik.ru",
  healthUrl: "https://design.vaybik.ru",
  description: "Дизайн-система и примеры сайтов для клиентов",
  type: "EXTERNAL" as const,
  containerNames: [] as string[],
  isPublic: true,
  isDeployed: true,
  isProduct: true,
  publicPagePath: null as string | null,
  manageUrl: null as string | null,
  sortOrder: 4,
  tags: ["design", "product", "atlas"],
  expectedStatus: 200,
  intervalSec: 60,
  timeoutMs: 10000,
};

async function main() {
  const row = await prisma.service.upsert({
    where: { slug: DATA.slug },
    create: DATA,
    update: {
      name: DATA.name,
      url: DATA.url,
      healthUrl: DATA.healthUrl,
      description: DATA.description,
      type: DATA.type,
      isPublic: DATA.isPublic,
      isDeployed: DATA.isDeployed,
      isProduct: DATA.isProduct,
      sortOrder: DATA.sortOrder,
      tags: DATA.tags,
      expectedStatus: DATA.expectedStatus,
    },
  });
  console.log(`✓ design-atlas id=${row.id}`);

  // Имя чата в реестре — как в UI («Вайбик Чат»), не перетираем manageUrl.
  const chat = await prisma.service.findUnique({ where: { slug: "chat" } });
  if (chat && chat.name !== "Вайбик Чат") {
    await prisma.service.update({
      where: { slug: "chat" },
      data: { name: "Вайбик Чат" },
    });
    console.log("✓ chat → «Вайбик Чат»");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
