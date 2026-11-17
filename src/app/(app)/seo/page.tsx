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

  const [pages, countersRow, robotsRow, llmsRow] = await Promise.all([
    prisma.seoPage.findMany({
      orderBy: [{ host: "asc" }, { path: "asc" }],
    }),
    prisma.setting.findUnique({ where: { key: "seo.counters" } }),
    prisma.setting.findUnique({ where: { key: "site.robots" } }),
    prisma.setting.findUnique({ where: { key: "site.llms" } }),
  ]);

  const asText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "text" in (value as object)) {
      return String((value as { text: string }).text);
    }
    return "";
  };

  return (
    <SeoPanel
      initialPages={JSON.parse(JSON.stringify(pages))}
      initialCounters={
        (countersRow?.value as Record<string, string | null>) || {}
      }
      initialRobots={asText(robotsRow?.value)}
      initialLlms={asText(llmsRow?.value)}
    />
  );
}
