-- CreateTable
CREATE TABLE "DbConnection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'postgres',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 5432,
    "database" TEXT NOT NULL,
    "secretId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "backupSchedule" TEXT,
    "retention" INTEGER NOT NULL DEFAULT 14,
    "externalStorage" JSONB,
    "lastSizeBytes" BIGINT,
    "lastTableCount" INTEGER,
    "lastPgVersion" TEXT,
    "lastInspectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DbConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DbSizeSnapshot" (
    "id" TEXT NOT NULL,
    "dbConnectionId" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DbSizeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "dbConnectionId" TEXT,
    "target" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "checksumSha256" TEXT,
    "sizeBytes" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DbConnection_slug_key" ON "DbConnection"("slug");

-- CreateIndex
CREATE INDEX "DbConnection_engine_idx" ON "DbConnection"("engine");

-- CreateIndex
CREATE INDEX "DbSizeSnapshot_dbConnectionId_takenAt_idx" ON "DbSizeSnapshot"("dbConnectionId", "takenAt");

-- CreateIndex
CREATE INDEX "Backup_dbConnectionId_startedAt_idx" ON "Backup"("dbConnectionId", "startedAt");

-- CreateIndex
CREATE INDEX "Backup_status_idx" ON "Backup"("status");

-- CreateIndex
CREATE INDEX "Backup_startedAt_idx" ON "Backup"("startedAt");

-- AddForeignKey
ALTER TABLE "DbSizeSnapshot" ADD CONSTRAINT "DbSizeSnapshot_dbConnectionId_fkey" FOREIGN KEY ("dbConnectionId") REFERENCES "DbConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_dbConnectionId_fkey" FOREIGN KEY ("dbConnectionId") REFERENCES "DbConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
