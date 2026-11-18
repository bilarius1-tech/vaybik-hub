-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "deleteIncomplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleteIncompleteError" TEXT;

-- AlterTable
ALTER TABLE "ClientService" ADD COLUMN     "activeFrom" DATE,
ADD COLUMN     "activeUntil" DATE,
ADD COLUMN     "paymentNote" TEXT;

-- CreateIndex
CREATE INDEX "Client_deleteIncomplete_idx" ON "Client"("deleteIncomplete");

-- CreateIndex
CREATE INDEX "ClientService_activeUntil_idx" ON "ClientService"("activeUntil");
