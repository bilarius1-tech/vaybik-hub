import { SeoPanel } from "@/components/seo/SeoPanel";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export default async function SeoPage() {
  try {
    await requireCan("settings.manage");
  } catch {
    redirect("/");
  }

  const [pages, countersRow] = await Promise.all([
    prisma.seoPage.findMany({
      orderBy: [{ host: "asc" }, { path: "asc" }],
    }),
    prisma.setting.findUnique({ where: { key: "seo.counters" } }),
  ]);

  return (
    <SeoPanel
      initialPages={JSON.parse(JSON.stringify(pages))}
      initialCounters={
        (countersRow?.value as Record<string, string | null>) || {}
      }
    />
  );
}
