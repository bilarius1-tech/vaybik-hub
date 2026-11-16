import { NotificationsPanel } from "@/components/settings/NotificationsPanel";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  try {
    await requireCan("settings.manage");
  } catch {
    redirect("/");
  }
  const rules = await prisma.notificationRule.findMany({
    orderBy: { createdAt: "desc" },
  });
  return (
    <NotificationsPanel initialRules={JSON.parse(JSON.stringify(rules))} />
  );
}
