/**
 * Тестовый restore дампа во временный postgres:16 (docker run --rm).
 * Не трогает прод-БД. Запуск только после «задеплой» и явного «да» на проде,
 * либо локально в dev.
 *
 *   npx tsx scripts/backup-restore-test.ts /path/to/db-….dump.enc
 *
 * Нужны: docker, BACKUP_ENCRYPTION_KEY, pg_restore/psql (или только docker).
 */
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  decryptAndGunzip,
  decryptBackupToBuffer,
  isLegacyPlainGzipEnc,
} from "../src/server/backup/run";

const execFileAsync = promisify(execFile);

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Использование: npx tsx scripts/backup-restore-test.ts <file.dump.enc>");
    process.exit(1);
  }
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    console.error("BACKUP_ENCRYPTION_KEY не задан");
    process.exit(1);
  }

  const name = `vaybik-restore-test-${Date.now()}`;
  const tmp = await mkdtemp(path.join(tmpdir(), "vaybik-brt-"));
  const dumpFile = path.join(tmp, "dump");

  console.log(`Поднимаю ${name} (postgres:16-alpine), сеть не публикую…`);
  try {
    await execFileAsync("docker", [
      "run",
      "-d",
      "--rm",
      "--name",
      name,
      "-e",
      "POSTGRES_PASSWORD=restore-test-only",
      "-e",
      "POSTGRES_USER=restore",
      "-e",
      "POSTGRES_DB=restore_db",
      "--label",
      "vaybik.managed=true",
      "postgres:16-alpine",
    ]);

    for (let i = 0; i < 30; i++) {
      try {
        await execFileAsync("docker", [
          "exec",
          name,
          "pg_isready",
          "-U",
          "restore",
          "-d",
          "restore_db",
        ]);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (isLegacyPlainGzipEnc(file)) {
      const sql = await decryptAndGunzip(file);
      await writeFile(`${dumpFile}.sql`, sql);
      await execFileAsync("docker", [
        "cp",
        `${dumpFile}.sql`,
        `${name}:/tmp/restore.sql`,
      ]);
      await execFileAsync("docker", [
        "exec",
        "-e",
        "PGPASSWORD=restore-test-only",
        name,
        "psql",
        "-U",
        "restore",
        "-d",
        "restore_db",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "/tmp/restore.sql",
      ]);
    } else {
      const dump = await decryptBackupToBuffer(file);
      await writeFile(dumpFile, dump);
      await execFileAsync("docker", ["cp", dumpFile, `${name}:/tmp/restore.dump`]);
      await execFileAsync("docker", [
        "exec",
        "-e",
        "PGPASSWORD=restore-test-only",
        name,
        "pg_restore",
        "--no-owner",
        "--no-acl",
        "-U",
        "restore",
        "-d",
        "restore_db",
        "/tmp/restore.dump",
      ]).catch((err) => {
        console.warn("pg_restore предупреждения:", err instanceof Error ? err.message.slice(0, 200) : err);
      });
    }

    const { stdout } = await execFileAsync("docker", [
      "exec",
      "-e",
      "PGPASSWORD=restore-test-only",
      name,
      "psql",
      "-U",
      "restore",
      "-d",
      "restore_db",
      "-tA",
      "-c",
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
    ]);
    console.log("OK. Таблиц в public:", String(stdout).trim());
  } finally {
    await execFileAsync("docker", ["rm", "-f", name]).catch(() => undefined);
    await rm(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
