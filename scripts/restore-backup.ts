/**
 * Восстановление из зашифрованного бэкапа (только вручную на сервере).
 *
 * Новые дампы:  …/db-….dump.enc   (pg_dump -Fc)
 * Старые:       …/db-….sql.gz.enc (plain + gzip)
 *
 * Пример:
 *   BACKUP_ENCRYPTION_KEY=... DATABASE_URL=... \
 *     npx tsx scripts/restore-backup.ts backups/admin/db-....dump.enc
 *
 * ВНИМАНИЕ: перезапишет текущую БД. Сделайте свежий бэкап перед restore.
 * Не используйте против прод-БД без явного согласия владельца.
 */
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  decryptAndGunzip,
  decryptBackupToBuffer,
  isCustomDumpEnc,
  isLegacyPlainGzipEnc,
} from "../src/server/backup/run";
import {
  parseDatabaseUrl,
  pgEnvFromUrl,
  sanitizePgError,
} from "../src/server/backup/pg-url";

const execFileAsync = promisify(execFile);

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Использование: npx tsx scripts/restore-backup.ts <db-….dump.enc|db-….sql.gz.enc>",
    );
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

  const conn = parseDatabaseUrl(process.env.DATABASE_URL);
  console.log(`Расшифровка → БД=${conn.database} @ ${conn.host}:${conn.port}`);

  const dir = await mkdtemp(path.join(tmpdir(), "vaybik-restore-"));
  const env = { ...process.env, ...pgEnvFromUrl(process.env.DATABASE_URL) };

  try {
    if (isCustomDumpEnc(file) || (!isLegacyPlainGzipEnc(file) && file.endsWith(".dump.enc"))) {
      const dump = await decryptBackupToBuffer(file);
      const dumpPath = path.join(dir, "restore.dump");
      await writeFile(dumpPath, dump);
      console.log("Восстановление (pg_restore -Fc)…");
      try {
        await execFileAsync(
          "pg_restore",
          ["--no-owner", "--no-acl", "--clean", "--if-exists", "-d", conn.database, dumpPath],
          { maxBuffer: 64 * 1024 * 1024, env },
        );
      } catch (err) {
        throw sanitizePgError(err, { database: conn.database, tool: "pg_restore" });
      }
      await unlink(dumpPath);
    } else {
      const sql = await decryptAndGunzip(file);
      const sqlPath = path.join(dir, "restore.sql");
      await writeFile(sqlPath, sql);
      console.log("Восстановление (psql, legacy plain)…");
      try {
        await execFileAsync(
          "psql",
          ["-v", "ON_ERROR_STOP=1", "-f", sqlPath],
          { maxBuffer: 64 * 1024 * 1024, env },
        );
      } catch (err) {
        throw sanitizePgError(err, { database: conn.database, tool: "psql" });
      }
      await unlink(sqlPath);
    }
  } finally {
    /* tmpdir cleaned by OS; partial files unlinked above */
  }

  console.log("Готово.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
