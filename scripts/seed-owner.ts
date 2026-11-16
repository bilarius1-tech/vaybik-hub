/**
 * Интерактивное создание первого owner.
 * Запуск: npm run seed:owner
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

  const rl = createInterface({ input, output });
  try {
    const email = (await ask(rl, "Email owner: ")).toLowerCase();
    const name = await ask(rl, "Имя (опц.): ");
    const password = await ask(rl, "Пароль (≥ 12): ");
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
    console.log("При первом входе потребуется настройка 2FA.");
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
