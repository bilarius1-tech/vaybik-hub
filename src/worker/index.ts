/**
 * Фоновый worker (pg-boss): health-checks, метрики сервера, агрегация, бэкапы, Telegram.
 */
import path from "node:path";
import { PgBoss } from "pg-boss";
import { runConnectionBackup } from "@/server/backup/connection-dump";
import { runAdminBackup } from "@/server/backup/run";
import { ensureAdminConnection } from "@/server/databases/ensure-admin";
import { prisma } from "@/server/db";
import {
  aggregateOldHealthChecks,
  pruneOldServerMetrics,
} from "@/server/services/aggregate";
import { checkAllDueServices } from "@/server/services/check-runner";
import { collectHostMetrics } from "@/server/services/metrics";
import { runClientMailCron } from "@/server/mail/client-notify";
import { notifyEvent } from "@/server/services/telegram";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[worker] DATABASE_URL не задан");
  process.exit(1);
}

async function main() {
  const boss = new PgBoss({
    connectionString: DATABASE_URL,
    application_name: "vaybik-hub-worker",
  });

  boss.on("error", (err) => console.error("[worker] pg-boss error", err));

  await boss.start();
  console.log("[worker] pg-boss started");

  await boss.createQueue("health-checks");
  await boss.createQueue("server-metrics");
  await boss.createQueue("maintenance");
  await boss.createQueue("admin-backup");
  await boss.createQueue("db-connection-backups");
  await boss.createQueue("client-mail");

  await boss.schedule("health-checks", "*/1 * * * *", {}, { tz: "Europe/Moscow" });
  await boss.schedule("server-metrics", "*/1 * * * *", {}, { tz: "Europe/Moscow" });
  await boss.schedule("maintenance", "15 3 * * *", {}, { tz: "Europe/Moscow" });
  await boss.schedule("admin-backup", "0 3 * * *", {}, { tz: "Europe/Moscow" });
  // Каждую минуту сверяем cron подключений (лёгкая проверка)
  await boss.schedule(
    "db-connection-backups",
    "* * * * *",
    {},
    { tz: "Europe/Moscow" },
  );
  // Письма о сроке: утро MSK (7 дн / 1 дн / истёк = activeUntil+1)
  await boss.schedule("client-mail", "0 9 * * *", {}, { tz: "Europe/Moscow" });

  await boss.work("health-checks", async () => {
    const n = await checkAllDueServices();
    console.log(`[worker] health-checks: checked ${n}`);
  });

  await boss.work("server-metrics", async () => {
    try {
      const m = await collectHostMetrics();
      await prisma.serverMetric.create({
        data: {
          cpu: m.cpu,
          memUsed: m.memUsed,
          memTotal: m.memTotal,
          diskUsed: m.diskUsed,
          diskTotal: m.diskTotal,
          load1: m.load1,
        },
      });
      console.log(
        `[worker] metrics cpu=${m.cpu}% load=${m.load1} mem=${m.memUsed}/${m.memTotal}`,
      );
    } catch (err) {
      console.warn("[worker] metrics failed", err);
    }
  });

  await boss.work("maintenance", async () => {
    const a = await aggregateOldHealthChecks();
    const p = await pruneOldServerMetrics();
    console.log(`[worker] maintenance: aggregated=${a} prunedMetrics=${p}`);
  });

  await boss.work("admin-backup", async () => {
    try {
      const admin = await ensureAdminConnection();
      const r = await runAdminBackup();
      if (admin) {
        await prisma.backup.create({
          data: {
            dbConnectionId: admin.id,
            target: "admin-db",
            trigger: "schedule",
            file: r.dbFile,
            status: "ok",
            sizeBytes: BigInt(r.dbBytes),
            finishedAt: new Date(),
          },
        });
        await prisma.backup.create({
          data: {
            dbConnectionId: admin.id,
            target: "uploads",
            trigger: "schedule",
            file: r.uploadsFile,
            status: "ok",
            finishedAt: new Date(),
          },
        });
      }
      console.log(
        `[worker] backup ok id=${r.id} pruned=${r.pruned} dbBytes=${r.dbBytes} file=${path.basename(r.dbFile)}`,
      );
      await notifyEvent({
        event: "backup.ok",
        entityId: admin?.id,
        text: `Ночной бэкап админки OK (${path.basename(r.dbFile)})`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[worker] backup failed:", msg);
      await notifyEvent({
        event: "backup.failed",
        text: `Ночной бэкап админки ОШИБКА: ${msg.slice(0, 200)}`,
      });
      throw err;
    }
  });

  await boss.work("client-mail", async () => {
    try {
      const r = await runClientMailCron();
      console.log(
        `[worker] client-mail checked=${r.checked} sent=${r.sent} skipped=${r.skipped}`,
      );
    } catch (err) {
      console.error("[worker] client-mail failed", err);
      throw err;
    }
  });

  await boss.work("db-connection-backups", async () => {
    const admin = await ensureAdminConnection();
    const connections = await prisma.dbConnection.findMany({
      where: {
        backupSchedule: { not: null },
        isSystem: false,
      },
    });
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }),
    );
    for (const conn of connections) {
      if (!conn.backupSchedule) continue;
      if (!cronMatchesNow(conn.backupSchedule, now)) continue;
      // Не дублировать, если уже ок за эту минуту
      const since = new Date(Date.now() - 90_000);
      const recent = await prisma.backup.findFirst({
        where: {
          dbConnectionId: conn.id,
          trigger: "schedule",
          startedAt: { gte: since },
        },
      });
      if (recent) continue;
      try {
        await runConnectionBackup({ connection: conn, trigger: "schedule" });
        console.log(`[worker] connection backup ok slug=${conn.slug}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[worker] connection backup failed slug=${conn.slug}:`, msg);
      }
    }
    void admin;
  });

  const shutdown = async () => {
    console.log("[worker] stopping…");
    await boss.stop({ graceful: true, timeout: 10_000 });
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

/** Упрощённый cron (5 полей): min hour dom month dow. Шаг вида star/N поддерживается. */
function cronMatchesNow(expr: string, now: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hour, dom, month, dow] = parts;
  const vals = [
    now.getMinutes(),
    now.getHours(),
    now.getDate(),
    now.getMonth() + 1,
    now.getDay(),
  ];
  const specs = [min, hour, dom, month, dow];
  return specs.every((spec, i) => matchField(spec!, vals[i]!));
}

function matchField(spec: string, value: number): boolean {
  if (spec === "*") return true;
  if (/^\*\/\d+$/.test(spec)) {
    const step = Number(spec.slice(2));
    return step > 0 && value % step === 0;
  }
  if (/^\d+$/.test(spec)) return Number(spec) === value;
  if (spec.includes(",")) {
    return spec.split(",").some((p) => matchField(p, value));
  }
  return false;
}

main().catch(async (err) => {
  console.error("[worker] fatal", err);
  await prisma.$disconnect();
  process.exit(1);
});
