import { SitePanel } from "@/components/cms/SitePanel";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function SitePage() {
  let ctx;
  try {
    ctx = await requireCan("content.manage");
  } catch {
    redirect("/");
  }

  const [navPages, navItems, redirects] = await Promise.all([
    prisma.page.findMany({
      where: { deletedAt: null },
      orderBy: { path: "asc" },
      select: { id: true, path: true, title: true },
    }),
    prisma.navItem.findMany({
      orderBy: [{ menu: "asc" }, { sortOrder: "asc" }],
      include: { page: { select: { id: true, path: true, title: true } } },
    }),
    prisma.redirect.findMany({ orderBy: { fromPath: "asc" } }),
  ]);

  return (
    <Suspense fallback={<p className="text-sm text-mu">Загрузка…</p>}>
      <SitePanel
        navPages={JSON.parse(JSON.stringify(navPages))}
        initialNav={JSON.parse(JSON.stringify(navItems))}
        initialRedirects={JSON.parse(JSON.stringify(redirects))}
        isOwner={ctx.user.role === "OWNER"}
      />
    </Suspense>
  );
}
