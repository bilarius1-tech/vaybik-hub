-- Импорт писал updatedById='import' — обнуляем до FK
UPDATE "Page" SET "updatedById" = NULL
WHERE "updatedById" IS NOT NULL
  AND "updatedById" NOT IN (SELECT "id" FROM "User");

-- DropIndex
DROP INDEX "Page_path_key";

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- Активные пути уникальны; в корзине путь можно «освободить» для новой страницы
CREATE UNIQUE INDEX "Page_path_active_key" ON "Page"("path") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Page_deletedAt_idx" ON "Page"("deletedAt");

-- CreateIndex
CREATE INDEX "Page_updatedAt_idx" ON "Page"("updatedAt");

-- CreateIndex
CREATE INDEX "Page_status_idx" ON "Page"("status");

-- CreateIndex
CREATE INDEX "Page_template_idx" ON "Page"("template");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
