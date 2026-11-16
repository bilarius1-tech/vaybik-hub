import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("public sitemap (db)", () => {
  it("включает только inSitemap=true", async () => {
    const host = `sitemap-test-${Date.now()}.test`;
    const included = await prisma.seoPage.create({
      data: {
        host,
        path: "/",
        title: "In",
        inSitemap: true,
        priority: 1,
      },
    });
    const excluded = await prisma.seoPage.create({
      data: {
        host,
        path: "/secret",
        title: "Out",
        inSitemap: false,
      },
    });

    try {
      const pages = await prisma.seoPage.findMany({
        where: { host, inSitemap: true },
      });
      expect(pages.map((p) => p.path)).toEqual(["/"]);
      expect(pages.some((p) => p.id === excluded.id)).toBe(false);
      expect(pages[0]?.id).toBe(included.id);
    } finally {
      await prisma.seoPage.deleteMany({ where: { host } });
    }
  });
});
