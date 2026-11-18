import { ClientsList } from "@/components/clients/ClientsList";
import { requireCan } from "@/server/auth/require";
import { listClients } from "@/server/clients/service";
import { resolveManageUrl } from "@/server/clients/status-map";
import {
  chatApiMissingKeys,
  getChatApiConfig,
  getChatSsoConfig,
} from "@/server/chat/config";
import { redirect } from "next/navigation";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  let auth;
  try {
    auth = await requireCan("clients.manage");
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
  const ssoReady = Boolean(getChatSsoConfig());

  const rows = clients.map((c) => {
    const chat = c.services.find((s) => s.service.slug === "chat");
    const chatManageHref = resolveManageUrl(
      chat?.service.manageUrl,
      chat?.externalId,
    );
    return {
      ...c,
      chatManageHref,
      canImpersonate: Boolean(
        ssoReady && chat?.externalId && chat.service.isProduct,
      ),
    };
  });

  return (
    <ClientsList
      initial={JSON.parse(JSON.stringify(rows))}
      initialQ={sp.q ?? ""}
      initialStatus={status ?? "all"}
      chatApiReady={apiReady}
      chatMissingKeys={chatApiMissingKeys()}
      totpEnabled={auth.user.totpEnabled}
    />
  );
}
