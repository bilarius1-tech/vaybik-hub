import { SitePanel } from "@/components/cms/SitePanel";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export default async function SitePage() {
  let ctx;
  try {
    ctx = await requireCan("content.manage");
  } catch {
    redirect("/");
  }

  const [pages, navItems, redirects] = await Promise.all([
    prisma.page.findMany({
      orderBy: [{ sortOrder: "asc" }, { path: "asc" }],
      include: { _count: { select: { blocks: true } } },
    }),
    prisma.navItem.findMany({
      orderBy: [{ menu: "asc" }, { sortOrder: "asc" }],
      include: { page: { select: { id: true, path: true, title: true } } },
    }),
    prisma.redirect.findMany({ orderBy: { fromPath: "asc" } }),
  ]);

  return (
    <SitePanel
      initialPages={JSON.parse(JSON.stringify(pages))}
      initialNav={JSON.parse(JSON.stringify(navItems))}
      initialRedirects={JSON.parse(JSON.stringify(redirects))}
      isOwner={ctx.user.role === "OWNER"}
    />
  );
}
