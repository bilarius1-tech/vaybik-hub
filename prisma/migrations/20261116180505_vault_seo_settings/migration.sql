-- CreateTable
CREATE TABLE "SeoPage" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'vaybik.ru',
    "path" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "canonical" TEXT,
    "robots" TEXT NOT NULL DEFAULT 'index,follow',
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "twitterCard" TEXT DEFAULT 'summary_large_image',
    "jsonLd" JSONB,
    "inSitemap" BOOLEAN NOT NULL DEFAULT true,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "changefreq" TEXT NOT NULL DEFAULT 'weekly',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "username" TEXT,
    "folder" TEXT,
    "tags" TEXT[],
    "note" TEXT,
    "dataEnc" BYTEA NOT NULL,
    "dataIv" BYTEA NOT NULL,
    "dataTag" BYTEA NOT NULL,
    "dekEnc" BYTEA NOT NULL,
    "dekIv" BYTEA NOT NULL,
    "dekTag" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoPage_host_path_key" ON "SeoPage"("host", "path");

-- CreateIndex
CREATE INDEX "Secret_folder_idx" ON "Secret"("folder");

-- CreateIndex
CREATE INDEX "Secret_kind_idx" ON "Secret"("kind");
