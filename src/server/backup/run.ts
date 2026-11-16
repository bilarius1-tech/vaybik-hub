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

const execFileAsync = promisify(execFile);

export const BACKUP_RETENTION_DAYS = 14;

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

async function dumpDatabase(outEnc: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан");
  const tmpSql = `${outEnc}.tmp.sql`;
  const tmpGz = `${outEnc}.tmp.gz`;
  await execFileAsync(
    "pg_dump",
    ["--no-owner", "--no-acl", "--format=plain", "--file", tmpSql, url],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  await pipeline(
    createReadStream(tmpSql),
    createGzip(),
    createWriteStream(tmpGz),
  );
  await unlink(tmpSql);
  const compressed = await readFile(tmpGz);
  await unlink(tmpGz);
  await writeFile(outEnc, encryptBuffer(compressed));
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
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".enc")) continue;
    const full = path.join(dir, name);
    const st = await stat(full);
    if (st.mtimeMs < cutoff) {
      await unlink(full);
      removed += 1;
    }
  }
  return removed;
}

export type BackupResult = {
  id: string;
  dbFile: string;
  uploadsFile: string;
  pruned: number;
};

/** Ежедневный бэкап БД админки + uploads, AES-256-GCM, ротация 14 дней */
export async function runAdminBackup(): Promise<BackupResult> {
  const root = backupsRoot();
  await mkdir(root, { recursive: true });
  const id = stamp();
  const dbFile = path.join(root, `db-${id}.sql.gz.enc`);
  const uploadsFile = path.join(root, `uploads-${id}.tar.gz.enc`);
  const dbTmp = `${dbFile}.partial`;
  const upTmp = `${uploadsFile}.partial`;

  await dumpDatabase(dbTmp);
  await rename(dbTmp, dbFile);
  await archiveUploads(upTmp);
  await rename(upTmp, uploadsFile);

  const pruned = await pruneOldBackups(root);
  return { id, dbFile, uploadsFile, pruned };
}

/** Расшифровать .enc → сжатый gzip Buffer */
export async function decryptBackupToGzip(filePath: string): Promise<Buffer> {
  return decryptBuffer(await readFile(filePath));
}

/** Расшифровать и gunzip → сырой payload */
export async function decryptAndGunzip(filePath: string): Promise<Buffer> {
  const compressed = await decryptBackupToGzip(filePath);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    Readable.from(compressed)
      .pipe(createGunzip())
      .on("data", (c: Buffer) => chunks.push(c))
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
}
