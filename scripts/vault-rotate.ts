/**
 * Ротация VAULT_MASTER_KEY: перешифровывает DEK всех Secret.
 * Использование:
 *   OLD_VAULT_MASTER_KEY=... VAULT_MASTER_KEY=<новый> npm run vault:rotate
 */
import { prisma } from "../src/server/db";
import { masterKeyFromEnv, rewrapDek } from "../src/server/vault/crypto";

async function main() {
  const oldRaw = process.env.OLD_VAULT_MASTER_KEY;
  if (!oldRaw) {
    console.error("Задайте OLD_VAULT_MASTER_KEY (старый ключ base64)");
    process.exit(1);
  }
  const oldMaster = Buffer.from(oldRaw, "base64");
  if (oldMaster.length !== 32) {
    console.error("OLD_VAULT_MASTER_KEY должен быть 32 байта");
    process.exit(1);
  }
  const newMaster = masterKeyFromEnv("VAULT_MASTER_KEY");
  const nextVersion = Number(process.env.VAULT_KEY_VERSION || "2");

  const secrets = await prisma.secret.findMany();
  console.log(`Найдено записей: ${secrets.length}`);

  for (const s of secrets) {
    const rewrapped = rewrapDek(
      {
        ciphertext: Buffer.from(s.dekEnc),
        iv: Buffer.from(s.dekIv),
        tag: Buffer.from(s.dekTag),
      },
      oldMaster,
      newMaster,
    );
    await prisma.secret.update({
      where: { id: s.id },
      data: {
        dekEnc: rewrapped.ciphertext as unknown as Uint8Array<ArrayBuffer>,
        dekIv: rewrapped.iv as unknown as Uint8Array<ArrayBuffer>,
        dekTag: rewrapped.tag as unknown as Uint8Array<ArrayBuffer>,
        keyVersion: nextVersion,
      },
    });
    console.log(`✓ ${s.title} (${s.id})`);
  }
  console.log(`Готово. Обновите VAULT_KEY_VERSION=${nextVersion} в .env`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
