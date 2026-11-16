/**
 * Восстановление из зашифрованного бэкапа (только вручную на сервере).
 *
 * Пример:
 *   BACKUP_ENCRYPTION_KEY=... DATABASE_URL=... \
 *     npx tsx scripts/restore-backup.ts backups/db-....sql.gz.enc
 *
 * ВНИМАНИЕ: перезапишет текущую БД. Сделайте свежий бэкап перед restore.
 */
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { decryptAndGunzip } from "../src/server/backup/run";

const execFileAsync = promisify(execFile);

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Использование: npx tsx scripts/restore-backup.ts <db-....sql.gz.enc>");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    console.error("BACKUP_ENCRYPTION_KEY не задан");
    process.exit(1);
  }

  console.log("Расшифровка…");
  const sql = await decryptAndGunzip(file);
  const dir = await mkdtemp(path.join(tmpdir(), "vaybik-restore-"));
  const sqlPath = path.join(dir, "restore.sql");
  await writeFile(sqlPath, sql);

  console.log("Восстановление в DATABASE_URL…");
  await execFileAsync("psql", [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    maxBuffer: 64 * 1024 * 1024,
  });
  await unlink(sqlPath);
  console.log("Готово.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
