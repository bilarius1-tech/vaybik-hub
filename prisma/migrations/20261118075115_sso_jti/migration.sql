-- CreateTable
CREATE TABLE "SsoJti" (
    "jti" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoJti_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "SsoJti_expiresAt_idx" ON "SsoJti"("expiresAt");

-- CreateIndex
CREATE INDEX "SsoJti_clientId_idx" ON "SsoJti"("clientId");

-- CreateIndex
CREATE INDEX "SsoJti_userId_idx" ON "SsoJti"("userId");
