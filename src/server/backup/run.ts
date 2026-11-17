import { execFile } from "node:child_process";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { createGzip, createGunzip } from "node:zlib";
import { encryptBuffer, decryptBuffer } from "@/server/backup/crypto";
import {
  parseDatabaseUrl,
  pgEnvFromUrl,
  sanitizePgError,
} from "@/server/backup/pg-url";

const execFileAsync = promisify(execFile);

export const BACKUP_RETENTION_DAYS = 14;

/** Минимум свободного места: 2× размер БД + 100 МБ запаса (байты) */
export const DISK_RESERVE_BYTES = 100 * 1024 * 1024;

export function backupsRoot(): string {
  return process.env.BACKUPS_DIR || path.join(process.cwd(), "backups");
}

export function uploadsRoot(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Каталог бэкапов админки: <root>/admin */
export function adminBackupDir(root = backupsRoot()): string {
  return path.join(root, "admin");
}

async function freeBytes(dir: string): Promise<number | null> {
  try {
    const { statfs } = await import("node:fs/promises");
    const s = await statfs(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

/** Оценка размера БД через pg_database_size (без секретов в ошибках) */
export async function estimateAdminDbBytes(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан");
  const conn = parseDatabaseUrl(url);
  try {
    const { stdout } = await execFileAsync(
      "psql",
      ["-v", "ON_ERROR_STOP=1", "-tA", "-c", "SELECT pg_database_size(current_database())"],
      {
        env: { ...process.env, ...pgEnvFromUrl(url) },
        maxBuffer: 1024 * 1024,
      },
    );
    const n = Number(String(stdout).trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: unknown }).code === "ENOENT"
    ) {
      // Нет psql на хосте (dev без клиента) — место не оцениваем, dump упадёт отдельно.
      return 0;
    }
    throw sanitizePgError(err, { database: conn.database, tool: "psql" });
  }
}

export async function assertEnoughDiskForDump(
  dir: string,
  dbBytes: number,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const free = await freeBytes(dir);
  if (free === null) return;
  const need = dbBytes * 2 + DISK_RESERVE_BYTES;
  if (free < need) {
    const freeMb = Math.round(free / (1024 * 1024));
    const needMb = Math.round(need / (1024 * 1024));
    throw new Error(
      `Мало места на диске для бэкапа: свободно ~${freeMb} МБ, нужно ≥ ${needMb} МБ`,
    );
  }
}

/**
 * pg_dump -Fc → AES-256-GCM.
 * Имя файла: …/db-<stamp>.dump.enc
 */
async function dumpDatabase(outEnc: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан");
  const conn = parseDatabaseUrl(url);
  const tmpDump = `${outEnc}.tmp.dump`;

  try {
    await execFileAsync(
      "pg_dump",
      ["--no-owner", "--no-acl", "--format=custom", "--file", tmpDump],
      {
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, ...pgEnvFromUrl(url) },
      },
    );
  } catch (err) {
    try {
      await unlink(tmpDump);
    } catch {
      /* ignore */
    }
    throw sanitizePgError(err, { database: conn.database, tool: "pg_dump" });
  }

  const dump = await readFile(tmpDump);
  await unlink(tmpDump);
  await writeFile(outEnc, encryptBuffer(dump));
}

async function archiveUploads(outEnc: string): Promise<void> {
  const root = uploadsRoot();
  await mkdir(root, { recursive: true });
  const tarPath = `${outEnc}.tar`;
  await execFileAsync("tar", ["-cf", tarPath, "-C", root, "."], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const tmpGz = `${outEnc}.tmp.gz`;
  await pipeline(
    createReadStream(tarPath),
    createGzip(),
    createWriteStream(tmpGz),
  );
  await unlink(tarPath);
  const compressed = await readFile(tmpGz);
  await unlink(tmpGz);
  await writeFile(outEnc, encryptBuffer(compressed));
}

export async function pruneOldBackups(
  dir = backupsRoot(),
  keepDays = BACKUP_RETENTION_DAYS,
): Promise<number> {
  if (!existsSync(dir)) return 0;
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  async function walk(current: string): Promise<void> {
    for (const name of await readdir(current)) {
      const full = path.join(current, name);
      const st = await stat(full);
      if (st.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!name.endsWith(".enc") && !name.endsWith(".sha256")) continue;
      if (st.mtimeMs < cutoff) {
        await unlink(full);
        removed += 1;
      }
    }
  }

  await walk(dir);
  return removed;
}

export type BackupResult = {
  id: string;
  dbFile: string;
  uploadsFile: string;
  pruned: number;
  dbBytes: number;
};

/** Ежедневный бэкап БД админки + uploads, AES-256-GCM, ротация 14 дней */
export async function runAdminBackup(): Promise<BackupResult> {
  const root = backupsRoot();
  const dir = adminBackupDir(root);
  await mkdir(dir, { recursive: true });

  const dbBytes = await estimateAdminDbBytes();
  await assertEnoughDiskForDump(dir, dbBytes);

  const id = stamp();
  const dbFile = path.join(dir, `db-${id}.dump.enc`);
  const uploadsFile = path.join(dir, `uploads-${id}.tar.gz.enc`);
  const dbTmp = `${dbFile}.partial`;
  const upTmp = `${uploadsFile}.partial`;

  await dumpDatabase(dbTmp);
  await rename(dbTmp, dbFile);
  await archiveUploads(upTmp);
  await rename(upTmp, uploadsFile);

  const pruned = await pruneOldBackups(root);
  return { id, dbFile, uploadsFile, pruned, dbBytes };
}

/** Расшифровать .enc → сырой payload (dump -Fc или gzip) */
export async function decryptBackupToBuffer(filePath: string): Promise<Buffer> {
  return decryptBuffer(await readFile(filePath));
}

/** @deprecated alias: расшифровка без gunzip (для -Fc и для последующего gunzip) */
export async function decryptBackupToGzip(filePath: string): Promise<Buffer> {
  return decryptBackupToBuffer(filePath);
}

/** Расшифровать и gunzip → сырой payload (старый формат .sql.gz.enc) */
export async function decryptAndGunzip(filePath: string): Promise<Buffer> {
  const compressed = await decryptBackupToBuffer(filePath);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    Readable.from(compressed)
      .pipe(createGunzip())
      .on("data", (c: Buffer) => chunks.push(c))
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export function isLegacyPlainGzipEnc(filePath: string): boolean {
  const base = path.basename(filePath);
  return base.includes(".sql.gz.enc") || base.endsWith(".sql.gz.enc");
}

export function isCustomDumpEnc(filePath: string): boolean {
  const base = path.basename(filePath);
  return base.includes(".dump.enc") || base.endsWith(".dump.enc");
}
