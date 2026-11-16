/**
 * Фоновый worker (pg-boss): health-checks, метрики сервера, агрегация, Telegram.
 */
import { PgBoss } from "pg-boss";
import { prisma } from "@/server/db";
import {
  aggregateOldHealthChecks,
  pruneOldServerMetrics,
} from "@/server/services/aggregate";
import { checkAllDueServices } from "@/server/services/check-runner";
import { collectHostMetrics } from "@/server/services/metrics";

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

  await boss.schedule("health-checks", "*/1 * * * *", {}, { tz: "Europe/Moscow" });
  await boss.schedule("server-metrics", "*/1 * * * *", {}, { tz: "Europe/Moscow" });
  await boss.schedule("maintenance", "15 3 * * *", {}, { tz: "Europe/Moscow" });

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

  const shutdown = async () => {
    console.log("[worker] stopping…");
    await boss.stop({ graceful: true, timeout: 10_000 });
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch(async (err) => {
  console.error("[worker] fatal", err);
  await prisma.$disconnect();
  process.exit(1);
});
