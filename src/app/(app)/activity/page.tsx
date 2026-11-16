import { ActivityPanel } from "@/components/users/ActivityPanel";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export default async function ActivityPage() {
  try {
    await requireCan("activity.read");
  } catch {
    redirect("/");
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { id: "desc" },
    take: 100,
  });

  return (
    <ActivityPanel
      initialLogs={logs.map((l) => ({
        ...l,
        id: l.id.toString(),
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
