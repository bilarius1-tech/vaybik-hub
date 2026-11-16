/**
 * Ручной бэкап БД + uploads.
 * Запуск: npm run backup:now
 * В Docker: docker compose exec worker node -e "..." или npm run backup:now через tsx
 */
import { runAdminBackup } from "../src/server/backup/run";

async function main() {
  const result = await runAdminBackup();
  console.log("Бэкап готов:");
  console.log(`  id: ${result.id}`);
  console.log(`  db: ${result.dbFile}`);
  console.log(`  uploads: ${result.uploadsFile}`);
  console.log(`  удалено старых: ${result.pruned}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
