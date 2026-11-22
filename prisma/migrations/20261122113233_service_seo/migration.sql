-- CreateTable
CREATE TABLE "ServiceSeo" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "canonical" TEXT,
    "robots" TEXT NOT NULL DEFAULT 'index,follow',
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "twitterCard" TEXT DEFAULT 'summary_large_image',
    "jsonLd" JSONB,
    "yandexMetrika" TEXT,
    "yandexWebmaster" TEXT,
    "googleSearchConsole" TEXT,
    "googleAnalytics" TEXT,
    "robotsTxt" TEXT,
    "llmsTxt" TEXT,
    "sitemapUrl" TEXT,
    "faviconSourceFile" TEXT,
    "faviconSourceMime" TEXT,
    "faviconGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceSeo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSeo_serviceId_key" ON "ServiceSeo"("serviceId");

-- AddForeignKey
ALTER TABLE "ServiceSeo" ADD CONSTRAINT "ServiceSeo_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
