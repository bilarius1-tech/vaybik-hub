/** Опубликовать главную `/`. */
import { prisma } from "../src/server/db";
import { publishPage } from "../src/server/cms/service";
import { bumpSiteVersion } from "../src/server/cms/site-version";

async function main() {
  const page = await prisma.page.findFirst({
    where: { path: "/", deletedAt: null },
  });
  if (!page) throw new Error("Страница / не найдена");
  const owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
    select: { id: true },
  });
  const { page: published, revision } = await publishPage(
    page.id,
    owner?.id ?? null,
    "Наши сервисы вместо офиса",
  );
  await bumpSiteVersion(prisma, "cms.home.services");
  console.log(
    "published",
    published.id,
    "status",
    published.status,
    "rev",
    revision.id,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
