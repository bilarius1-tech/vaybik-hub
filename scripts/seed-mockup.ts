/**
 * Идемпотентно создаёт сервис «Генератор мокапов» (slug=mockup).
 * Контейнер/деплой мокапа не трогаем.
 */
import { prisma } from "../src/server/db";
import { ensureServiceSeo } from "../src/server/services/seo";

const DATA = {
  slug: "mockup",
  name: "Генератор мокапов",
  url: "https://mockup.vaybik.ru",
  healthUrl: "https://mockup.vaybik.ru",
  description:
    "Бесплатный генератор мокапов: баннер, визитка, телефон — без регистрации",
  type: "EXTERNAL" as const,
  containerNames: [] as string[],
  repoUrl: "https://github.com/bilarius1-tech/vaybik-mockup",
  isPublic: true,
  isDeployed: true,
  isProduct: true,
  publicPagePath: null as string | null,
  manageUrl: null as string | null,
  sortOrder: 6,
  tags: ["mockup", "product"],
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
      repoUrl: DATA.repoUrl,
      isPublic: DATA.isPublic,
      isDeployed: DATA.isDeployed,
      isProduct: DATA.isProduct,
      sortOrder: DATA.sortOrder,
      tags: DATA.tags,
      expectedStatus: DATA.expectedStatus,
    },
  });
  await ensureServiceSeo(prisma, row);
  console.log(`✓ mockup id=${row.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
