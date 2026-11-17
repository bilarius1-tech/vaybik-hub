import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { DbConnection } from "@prisma/client";
import { encryptBuffer, decryptBuffer } from "@/server/backup/crypto";
import { sha256File, writeSha256Sidecar } from "@/server/backup/checksum";
import {
  assertEnoughDiskForDump,
  backupsRoot,
  pruneOldBackups,
} from "@/server/backup/run";
import { sanitizePgError } from "@/server/backup/pg-url";
import { resolveCredentials } from "@/server/databases/credentials";
import { prisma } from "@/server/db";
import { notifyEvent } from "@/server/services/telegram";

const execFileAsync = promisify(execFile);

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export async function verifyCustomDumpEnc(encPath: string): Promise<void> {
  const dump = decryptBuffer(await readFile(encPath));
  const tmp = `${encPath}.verify.dump`;
  await writeFile(tmp, dump);
  try {
    await execFileAsync("pg_restore", ["-l", tmp], {
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (err) {
    throw sanitizePgError(err, { tool: "pg_restore" });
  } finally {
    try {
      await unlink(tmp);
    } catch {
      /* ignore */
    }
  }
}

/**
 * pg_dump -Fc → encrypt → Backup row + sha256.
 * Не пишет URI/пароль в error.
 */
export async function runConnectionBackup(params: {
  connection: DbConnection;
  trigger: "manual" | "schedule";
  createdById?: string | null;
}): Promise<{ backupId: string; file: string; sizeBytes: number }> {
  const { connection, trigger, createdById } = params;
  const dir = path.join(backupsRoot(), connection.slug);
  await mkdir(dir, { recursive: true });

  const creds = await resolveCredentials(connection);
  const sizeEstimate = Number(connection.lastSizeBytes ?? 0) || 50 * 1024 * 1024;
  await assertEnoughDiskForDump(dir, sizeEstimate);

  const id = stamp();
  const finalName = `${id}.dump.enc`;
  const finalPath = path.join(dir, finalName);
  const partial = `${finalPath}.partial`;
  const tmpDump = `${finalPath}.tmp.dump`;

  const row = await prisma.backup.create({
    data: {
      dbConnectionId: connection.id,
      target: connection.isSystem ? "admin-db" : "connection",
      trigger,
      file: finalPath,
      status: "running",
      createdById: createdById ?? null,
    },
  });

  try {
    await execFileAsync(
      "pg_dump",
      ["--no-owner", "--no-acl", "--format=custom", "--file", tmpDump],
      {
        maxBuffer: 64 * 1024 * 1024,
        env: {
          ...process.env,
          PGHOST: creds.host,
          PGPORT: String(creds.port),
          PGUSER: creds.user,
          PGPASSWORD: creds.password,
          PGDATABASE: creds.database,
        },
      },
    );

    const dumpBuf = await readFile(tmpDump);
    await unlink(tmpDump);
    await writeFile(partial, encryptBuffer(dumpBuf));
    await rename(partial, finalPath);

    await verifyCustomDumpEnc(finalPath);
    const checksum = await sha256File(finalPath);
    await writeSha256Sidecar(finalPath, checksum);
    const st = await stat(finalPath);

    await prisma.backup.update({
      where: { id: row.id },
      data: {
        status: "ok",
        checksumSha256: checksum,
        sizeBytes: BigInt(st.size),
        finishedAt: new Date(),
      },
    });

    await pruneOldBackups(dir, connection.retention);
    await notifyEvent({
      event: "backup.ok",
      entityId: connection.id,
      text: `Бэкап ОК: ${connection.name} (${Math.round(st.size / 1024)} КБ)`,
    });

    return { backupId: row.id, file: finalPath, sizeBytes: st.size };
  } catch (err) {
    for (const f of [tmpDump, partial]) {
      if (existsSync(f)) {
        try {
          await unlink(f);
        } catch {
          /* ignore */
        }
      }
    }
    const message =
      err instanceof Error ? err.message.slice(0, 400) : "backup failed";
    await prisma.backup.update({
      where: { id: row.id },
      data: {
        status: "error",
        error: message,
        finishedAt: new Date(),
      },
    });
    await notifyEvent({
      event: "backup.failed",
      entityId: connection.id,
      text: `Бэкап ОШИБКА: ${connection.name} — ${message}`,
    });
    throw err;
  }
}
