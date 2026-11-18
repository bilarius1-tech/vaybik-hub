/**
 * Интерактивный сброс пароля пользователя (argon2id).
 * Пароль читается с TTY, в лог/argv не попадает.
 *
 *   npx tsx scripts/reset-user-password.ts bilariuss@yandex.ru
 *   docker compose exec -it app npx tsx scripts/reset-user-password.ts bilariuss@yandex.ru
 */
import { createInterface } from "node:readline";
import { prisma } from "../src/server/db";
import { hashPassword } from "../src/server/crypto/password";

function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Нужен интерактивный терминал (TTY). Запустите с -it."));
      return;
    }
    process.stdout.write(prompt);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    // скрыть ввод
    const stdin = process.stdin as NodeJS.ReadStream & { setRawMode?: (v: boolean) => void };
    const wasRaw = stdin.isRaw;
    if (typeof stdin.setRawMode === "function") stdin.setRawMode(true);

    let value = "";
    const onData = (buf: Buffer) => {
      const s = buf.toString("utf8");
      for (const ch of s) {
        if (ch === "\n" || ch === "\r" || ch === "\u0004") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          reject(new Error("Отменено"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (ch >= " ") value += ch;
      }
    };
    function cleanup() {
      stdin.off("data", onData);
      if (typeof stdin.setRawMode === "function") stdin.setRawMode(!!wasRaw);
      rl.close();
    }
    stdin.on("data", onData);
  });
}

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Использование: npx tsx scripts/reset-user-password.ts <email>");
    process.exit(2);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Пользователь ${email} не найден`);
    process.exit(1);
  }

  console.log(`Сброс пароля для ${email} (${user.role}), id=${user.id}`);
  const p1 = await readSecret("Новый пароль (≥12 символов): ");
  const p2 = await readSecret("Ещё раз: ");
  if (p1 !== p2) {
    console.error("Пароли не совпали");
    process.exit(1);
  }

  const passwordHash = await hashPassword(p1);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  // сбросить «свежий» reauth — после смены пароля лучше войти заново при необходимости
  await prisma.session.updateMany({
    where: { userId: user.id },
    data: { reauthUntil: null },
  });

  console.log("✓ Пароль обновлён. Старые сессии оставлены (remember); reauth сброшен.");
  console.log("  Для входа в админку используйте новый пароль при следующем reauth/логине.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
