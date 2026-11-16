/**
 * Фоновый worker (pg-boss) — заглушка Фазы 0.
 * В Фазе 1: health-checks, уведомления, бэкапы.
 */
async function main() {
  console.log("[worker] stub started — задачи появятся в Фазе 1");
  // Держим процесс живым для docker/compose-совместимости
  const keepAlive = setInterval(() => {
    // no-op heartbeat
  }, 60_000);

  const shutdown = () => {
    clearInterval(keepAlive);
    console.log("[worker] stub stopped");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
