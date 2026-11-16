-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('DOCKER', 'EXTERNAL', 'STATIC');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('UP', 'DOWN', 'DEGRADED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "type" "ServiceType" NOT NULL DEFAULT 'DOCKER',
    "containerNames" TEXT[],
    "composeProject" TEXT,
    "repoUrl" TEXT,
    "branch" TEXT DEFAULT 'main',
    "healthUrl" TEXT,
    "expectedStatus" INTEGER NOT NULL DEFAULT 200,
    "keyword" TEXT,
    "intervalSec" INTEGER NOT NULL DEFAULT 60,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isDeployed" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "status" "CheckStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "certExpiresAt" TIMESTAMP(3),
    "lastResponseMs" INTEGER,
    "ownerPartnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "CheckStatus" NOT NULL,
    "httpStatus" INTEGER,
    "responseMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerMetric" (
    "id" BIGSERIAL NOT NULL,
    "cpu" DOUBLE PRECISION NOT NULL,
    "memUsed" BIGINT NOT NULL,
    "memTotal" BIGINT NOT NULL,
    "diskUsed" BIGINT NOT NULL,
    "diskTotal" BIGINT NOT NULL,
    "load1" DOUBLE PRECISION NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "chatIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "throttleMin" INTEGER NOT NULL DEFAULT 10,
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationThrottle" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "HealthCheck_serviceId_checkedAt_idx" ON "HealthCheck"("serviceId", "checkedAt");

-- CreateIndex
CREATE INDEX "ServerMetric_takenAt_idx" ON "ServerMetric"("takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationThrottle_key_key" ON "NotificationThrottle"("key");

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
