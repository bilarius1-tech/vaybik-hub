/**
 * Создаёт/обновляет пользователя для e2e с известным TOTP-секретом.
 * Не для продакшена.
 */
import { encryptString } from "../src/server/crypto/envelope";
import { hashPassword } from "../src/server/crypto/password";
import { generateBackupCodes, hashBackupCode } from "../src/server/crypto/totp";
import { prisma } from "../src/server/db";

const EMAIL = process.env.E2E_EMAIL || "e2e-owner@vaybik.test";
const PASSWORD = process.env.E2E_PASSWORD || "e2e-password-12";
const TOTP_SECRET =
  process.env.E2E_TOTP_SECRET || "3NOK6FBL53UNIUTA2EWAO6W2ZDH34YPF";

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      name: "E2E Owner",
      passwordHash,
      role: "OWNER",
      totpEnabled: true,
      totpSecretEnc: encryptString(TOTP_SECRET),
      isBlocked: false,
    },
    update: {
      passwordHash,
      totpEnabled: true,
      totpSecretEnc: encryptString(TOTP_SECRET),
      isBlocked: false,
      role: "OWNER",
    },
  });

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.pendingLogin.deleteMany({ where: { userId: user.id } });
  await prisma.backupCode.deleteMany({ where: { userId: user.id } });
  await prisma.loginAttempt.deleteMany({
    where: { key: { in: [`email:${EMAIL}`, "ip:127.0.0.1"] } },
  });

  const codes = generateBackupCodes(10);
  await prisma.backupCode.createMany({
    data: codes.map((code) => ({
      userId: user.id,
      codeHash: hashBackupCode(code),
    })),
  });
  console.log(
    JSON.stringify(
      { email: EMAIL, password: PASSWORD, totpSecret: TOTP_SECRET, backupCodes: codes },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
