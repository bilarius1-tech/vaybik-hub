import { ServiceForm } from "@/components/services/ServiceForm";
import { requireCan } from "@/server/auth/require";
import { redirect } from "next/navigation";

export default async function NewServicePage() {
  try {
    await requireCan("services.manage");
  } catch {
    redirect("/");
  }
  return (
    <div className="space-y-4">
      <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
        Новый сервис
      </h2>
      <ServiceForm mode="create" />
    </div>
  );
}
