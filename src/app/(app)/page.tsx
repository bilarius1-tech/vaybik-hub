import { DashboardView } from "@/components/dashboard/DashboardView";
import { requireCan, requireAuth } from "@/server/auth/require";
import { getDashboardSummary } from "@/server/services/dashboard";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const auth = await requireAuth();
  if (auth.user.role === "CLIENT") {
    redirect("/my-services");
  }
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
