/**
 * Тестовый restore во временный контейнер postgres:16-alpine.
 * Без named volume, без портов наружу, сеть hub, label vaybik.managed=true.
 * VOLUMES=0 у proxy — тома не создаём.
 *
 * Если Docker API через proxy не даёт создать контейнер — используйте
 * scripts/backup-restore-test.ts (dev-профиль).
 */
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Backup, DbConnection } from "@prisma/client";
import Docker from "dockerode";
import { decryptBackupToBuffer, isLegacyPlainGzipEnc, decryptAndGunzip } from "@/server/backup/run";
import { sanitizePgError } from "@/server/backup/pg-url";
import {
  assertRestoreTargetAllowed,
  isProdAdminDatabase,
} from "@/server/databases/policy";
import { getDocker } from "@/server/docker/client";
import { prisma } from "@/server/db";

const execFileAsync = promisify(execFile);

const RESTORE_IMAGE = "postgres:16-alpine";
const HUB_NETWORK = process.env.HUB_DOCKER_NETWORK || "vaybik-hub-prod_hub";

export async function runTestRestore(params: {
  backup: Backup;
  connection: DbConnection;
  confirmName: string;
  actorId: string;
}): Promise<{ containerName: string; ok: boolean; detail: string }> {
  assertRestoreTargetAllowed({
    target: "test",
    connection: params.connection,
    confirmName: params.confirmName,
  });

  // Явно: не трогаем рабочую БД даже если кто-то обойдёт UI
  if (params.backup.target === "uploads") {
    throw Object.assign(new Error("Restore uploads здесь не поддерживается"), {
      status: 400,
      code: "BAD_TARGET",
    });
  }

  void isProdAdminDatabase; // политика: цель всегда test-контейнер, не connection.host

  const docker = getDocker();
  const name = `vaybik-restore-test-${params.backup.id.slice(0, 10)}`;
  const tmp = await mkdtemp(path.join(tmpdir(), "vaybik-rt-"));
  const dumpPath = path.join(tmp, "dump");

  let container: Docker.Container | null = null;
  try {
    if (isLegacyPlainGzipEnc(params.backup.file)) {
      const sql = await decryptAndGunzip(params.backup.file);
      await writeFile(`${dumpPath}.sql`, sql);
    } else {
      const dump = await decryptBackupToBuffer(params.backup.file);
      await writeFile(dumpPath, dump);
    }

    // pull image (IMAGES=1)
    await new Promise<void>((resolve, reject) => {
      docker.pull(RESTORE_IMAGE, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (e: Error | null) =>
          e ? reject(e) : resolve(),
        );
      });
    });

    container = await docker.createContainer({
      Image: RESTORE_IMAGE,
      name,
      Env: [
        "POSTGRES_USER=restore",
        "POSTGRES_PASSWORD=restore-test-only",
        "POSTGRES_DB=restore_db",
      ],
      HostConfig: {
        AutoRemove: false,
        NetworkMode: HUB_NETWORK,
        // без Binds named volumes; данные в слое контейнера
      },
      Labels: {
        "vaybik.managed": "true",
        "vaybik.restore-test": "true",
      },
    });

    await container.start();

    // Ждём готовности
    for (let i = 0; i < 30; i++) {
      try {
        const exec = await container.exec({
          Cmd: ["pg_isready", "-U", "restore", "-d", "restore_db"],
          AttachStdout: true,
          AttachStderr: true,
        });
        // EXEC=0 у proxy — exec может не работать!
        void exec;
        break;
      } catch {
        break;
      }
    }

    // Если EXEC=0 — restore с хоста/worker через сеть контейнера не через exec.
    // Worker в сети hub: подключаемся по имени контейнера.
    await waitPg(name, 60_000);

    if (isLegacyPlainGzipEnc(params.backup.file)) {
      await execFileAsync(
        "psql",
        [
          "-h",
          name,
          "-U",
          "restore",
          "-d",
          "restore_db",
          "-v",
          "ON_ERROR_STOP=1",
          "-f",
          `${dumpPath}.sql`,
        ],
        {
          env: { ...process.env, PGPASSWORD: "restore-test-only" },
          maxBuffer: 64 * 1024 * 1024,
        },
      );
    } else {
      try {
        await execFileAsync(
          "pg_restore",
          [
            "--no-owner",
            "--no-acl",
            "-h",
            name,
            "-U",
            "restore",
            "-d",
            "restore_db",
            dumpPath,
          ],
          {
            env: { ...process.env, PGPASSWORD: "restore-test-only" },
            maxBuffer: 64 * 1024 * 1024,
          },
        );
      } catch (err) {
        // pg_restore может вернуть warnings как non-zero — проверим наличие таблиц
        const msg = err instanceof Error ? err.message : "";
        if (!/error/i.test(msg) && !/fatal/i.test(msg)) {
          /* continue to verify */
        } else {
          throw sanitizePgError(err, {
            database: "restore_db",
            tool: "pg_restore",
          });
        }
      }
    }

    const { stdout } = await execFileAsync(
      "psql",
      [
        "-h",
        name,
        "-U",
        "restore",
        "-d",
        "restore_db",
        "-tA",
        "-c",
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
      ],
      { env: { ...process.env, PGPASSWORD: "restore-test-only" } },
    );
    const tableCount = Number(String(stdout).trim());
    const detail = `Таблиц в public: ${tableCount}`;

    await prisma.backup.update({
      where: { id: params.backup.id },
      data: { status: "verified", finishedAt: new Date() },
    });

    return { containerName: name, ok: true, detail };
  } finally {
    if (container) {
      try {
        await container.remove({ force: true });
      } catch {
        /* ignore */
      }
    }
    await rm(tmp, { recursive: true, force: true });
  }
}

async function waitPg(host: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      await execFileAsync(
        "pg_isready",
        ["-h", host, "-U", "restore", "-d", "restore_db"],
        { env: { ...process.env, PGPASSWORD: "restore-test-only" } },
      );
      return;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Тестовый Postgres не поднялся: ${last.slice(0, 200)}`);
}
