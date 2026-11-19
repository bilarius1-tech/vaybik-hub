-- AlterTable
ALTER TABLE "Client" ADD COLUMN "emailNotifyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ClientMailLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientServiceId" TEXT,
    "kind" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "periodKey" TEXT,
    "inviteId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientMailLog_clientId_createdAt_idx" ON "ClientMailLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientMailLog_kind_createdAt_idx" ON "ClientMailLog"("kind", "createdAt");

-- Partial unique: одно успешное письмо на (сервис, вид, срок)
CREATE UNIQUE INDEX "ClientMailLog_period_sent_key"
  ON "ClientMailLog" ("clientServiceId", "kind", "periodKey")
  WHERE "clientServiceId" IS NOT NULL
    AND "periodKey" IS NOT NULL
    AND "status" = 'sent';

-- AddForeignKey
ALTER TABLE "ClientMailLog" ADD CONSTRAINT "ClientMailLog_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
