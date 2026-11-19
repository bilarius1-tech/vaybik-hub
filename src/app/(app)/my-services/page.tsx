import { MyServicesView } from "@/components/clients/MyServicesView";
import { requireCan } from "@/server/auth/require";
import { listMyServices } from "@/server/clients/access";
import { redirect } from "next/navigation";

export default async function MyServicesPage() {
  let auth;
  try {
    auth = await requireCan("client.self");
  } catch {
    redirect("/");
  }

  const data = await listMyServices(auth.user.id);
  if (!data) {
    return (
      <div className="rounded-[10px] border border-bd bg-card px-4 py-6 text-[14px] text-mu">
        Нет привязки к клиенту. Обратитесь в студию Вайбик.
      </div>
    );
  }

  return (
    <MyServicesView
      clientName={data.client.name}
      siteUrl={data.client.siteUrl}
      services={JSON.parse(JSON.stringify(data.services))}
    />
  );
}
