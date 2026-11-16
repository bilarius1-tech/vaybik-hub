import { DashboardView } from "@/components/dashboard/DashboardView";
import { requireCan } from "@/server/auth/require";
import { getDashboardSummary } from "@/server/services/dashboard";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  try {
    await requireCan("services.manage");
  } catch {
    redirect("/profile");
  }
  const summary = await getDashboardSummary("week");
  return (
    <DashboardView
      initial={JSON.parse(JSON.stringify(summary))}
    />
  );
}
