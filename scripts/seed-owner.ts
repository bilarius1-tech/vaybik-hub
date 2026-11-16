/**
 * Создание первого owner.
 * Интерактивно: npm run seed:owner
 * Без вопросов: SEED_EMAIL=… SEED_PASSWORD=… [SEED_NAME=…] npm run seed:owner
 * (пароль лучше передавать через файл/окружение, а не в истории shell)
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { hashPassword } from "../src/server/crypto/password";
import { prisma } from "../src/server/db";

async function ask(rl: ReturnType<typeof createInterface>, q: string) {
  return (await rl.question(q)).trim();
}

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (existing) {
    console.error(`Owner уже есть: ${existing.email}`);
    process.exit(1);
  }

  const nonInteractive = !!(process.env.SEED_EMAIL && process.env.SEED_PASSWORD);
  const rl = nonInteractive ? null : createInterface({ input, output });
  try {
    const email = (
      nonInteractive ? process.env.SEED_EMAIL!.trim() : await ask(rl!, "Email owner: ")
    ).toLowerCase();
    const name = nonInteractive
      ? (process.env.SEED_NAME ?? "").trim()
      : await ask(rl!, "Имя (опц.): ");
    const password = nonInteractive
      ? process.env.SEED_PASSWORD!
      : await ask(rl!, "Пароль (≥ 12): ");
    if (!email || password.length < 12) {
      console.error("Нужны email и пароль ≥ 12 символов");
      process.exit(1);
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role: "OWNER",
      },
    });
    console.log(`Создан owner ${user.email} (${user.id})`);
    if (
      !["false", "0", "no", "off"].includes((process.env.REQUIRE_2FA ?? "").toLowerCase())
    ) {
      console.log("При первом входе потребуется настройка 2FA.");
    }
  } finally {
    rl?.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
