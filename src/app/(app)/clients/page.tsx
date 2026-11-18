import { ClientsList } from "@/components/clients/ClientsList";
import { requireCan } from "@/server/auth/require";
import { listClients } from "@/server/clients/service";
import { chatApiMissingKeys, getChatApiConfig } from "@/server/chat/config";
import { redirect } from "next/navigation";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  try {
    await requireCan("clients.manage");
  } catch {
    redirect("/");
  }

  const sp = await searchParams;
  const status =
    sp.status === "active" ||
    sp.status === "paused" ||
    sp.status === "archived"
      ? sp.status
      : undefined;
  const clients = await listClients({ q: sp.q, status });
  const apiReady = Boolean(getChatApiConfig());

  return (
    <ClientsList
      initial={JSON.parse(JSON.stringify(clients))}
      initialQ={sp.q ?? ""}
      initialStatus={status ?? "all"}
      chatApiReady={apiReady}
      chatMissingKeys={chatApiMissingKeys()}
    />
  );
}
