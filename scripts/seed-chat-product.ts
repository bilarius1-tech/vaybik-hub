/**
 * Идемпотентно помечает сервис slug=chat как продукт и проставляет manageUrl,
 * если поле ещё пустое (ручное значение не перетираем).
 *
 * Dev: chat-test.vaybik.ru | Prod (APP_ENV=prod): chat.vaybik.ru
 * Если задан CHAT_BASE_URL — хост берём из него.
 */
import { prisma } from "../src/server/db";

function defaultManageUrl(): string {
  const fromEnv = (process.env.CHAT_BASE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return `${fromEnv}/manage/clients/{externalId}`;
  const host =
    process.env.APP_ENV === "prod"
      ? "https://chat.vaybik.ru"
      : "https://chat-test.vaybik.ru";
  return `${host}/manage/clients/{externalId}`;
}

async function main() {
  const manageUrl = defaultManageUrl();
  const existing = await prisma.service.findUnique({ where: { slug: "chat" } });

  if (!existing) {
    await prisma.service.create({
      data: {
        slug: "chat",
        name: "Чат",
        url: manageUrl.startsWith("https://chat.vaybik.ru")
          ? "https://chat.vaybik.ru"
          : "https://chat-test.vaybik.ru",
        description: "ИИ-чат для клиентов студии",
        type: "DOCKER",
        containerNames: [],
        isPublic: true,
        isDeployed: true,
        isProduct: true,
        manageUrl,
        publicPagePath: null,
        sortOrder: 3,
        tags: ["chat", "product"],
        expectedStatus: 200,
        intervalSec: 60,
        timeoutMs: 10000,
      },
    });
    console.log("✓ chat создан как продукт");
    return;
  }

  await prisma.service.update({
    where: { slug: "chat" },
    data: {
      isProduct: true,
      isDeployed: true,
      name: existing.name === "Chat" ? "Чат" : existing.name,
      tags: existing.tags.includes("product")
        ? existing.tags
        : [...existing.tags.filter((t) => t !== "undeployed"), "product"],
      // не перетираем вручную заполненный manageUrl
      ...(existing.manageUrl ? {} : { manageUrl }),
    },
  });
  console.log(
    `✓ chat: isProduct=true${existing.manageUrl ? " (manageUrl без изменений)" : `, manageUrl=${manageUrl}`}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
