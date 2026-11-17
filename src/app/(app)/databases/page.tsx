import { DatabasesPanel } from "@/components/databases/DatabasesPanel";
import { requireCan } from "@/server/auth/require";
import { redirect } from "next/navigation";

export default async function DatabasesPage() {
  try {
    await requireCan("databases.read");
  } catch {
    redirect("/");
  }
  return <DatabasesPanel />;
}
