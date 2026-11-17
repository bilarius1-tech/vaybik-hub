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

  const [pages, countersRow, robotsRow] = await Promise.all([
    prisma.seoPage.findMany({
      orderBy: [{ host: "asc" }, { path: "asc" }],
    }),
    prisma.setting.findUnique({ where: { key: "seo.counters" } }),
    prisma.setting.findUnique({ where: { key: "site.robots" } }),
  ]);

  const robotsText =
    typeof robotsRow?.value === "string"
      ? robotsRow.value
      : robotsRow?.value &&
          typeof robotsRow.value === "object" &&
          "text" in (robotsRow.value as object)
        ? String((robotsRow.value as { text: string }).text)
        : "";

  return (
    <SeoPanel
      initialPages={JSON.parse(JSON.stringify(pages))}
      initialCounters={
        (countersRow?.value as Record<string, string | null>) || {}
      }
      initialRobots={robotsText}
    />
  );
}
