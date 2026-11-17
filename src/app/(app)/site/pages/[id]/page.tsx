import { PageEditor } from "@/components/cms/PageEditor";
import { requireCan } from "@/server/auth/require";
import { getPageWithBlocks } from "@/server/cms/service";
import { prisma } from "@/server/db";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function SitePageEditorPage({ params }: Props) {
  let ctx;
  try {
    ctx = await requireCan("content.manage");
  } catch {
    redirect("/");
  }

  const { id } = await params;
  const page = await getPageWithBlocks(id);
  if (!page) notFound();

  const seoPages = await prisma.seoPage.findMany({
    where: { host: "vaybik.ru" },
    orderBy: { path: "asc" },
    select: { id: true, path: true, title: true },
  });

  return (
    <PageEditor
      initialPage={JSON.parse(JSON.stringify(page))}
      seoPages={JSON.parse(JSON.stringify(seoPages))}
      isOwner={ctx.user.role === "OWNER"}
      sitePublicOrigin={
        process.env.SITE_PUBLIC_ORIGIN || "https://vaybik.ru"
      }
    />
  );
}
