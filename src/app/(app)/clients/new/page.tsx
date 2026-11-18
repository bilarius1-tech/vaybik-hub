import { ClientCreateForm } from "@/components/clients/ClientCreateForm";
import { requireCan } from "@/server/auth/require";
import { redirect } from "next/navigation";

export default async function NewClientPage() {
  try {
    await requireCan("clients.manage");
  } catch {
    redirect("/");
  }
  return <ClientCreateForm />;
}
