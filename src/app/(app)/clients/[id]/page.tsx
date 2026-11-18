import { ClientDetail } from "@/components/clients/ClientDetail";
import { requireCan } from "@/server/auth/require";
import { getClient } from "@/server/clients/service";
import { resolveManageUrl } from "@/server/clients/status-map";
import {
  chatApiMissingKeys,
  getChatApiConfig,
  getChatSsoConfig,
} from "@/server/chat/config";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function ClientPage({ params }: Props) {
  let auth;
  try {
    auth = await requireCan("clients.manage");
  } catch {
    redirect("/");
  }

  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const links = client.services.map((cs) => ({
    ...cs,
    manageHref: resolveManageUrl(cs.service.manageUrl, cs.externalId),
  }));

  const payload = JSON.parse(
    JSON.stringify({
      ...client,
      services: links,
    }),
  );

  return (
    <ClientDetail
      key={`${client.id}-${client.updatedAt}-${client.services
        .map(
          (s) =>
            `${s.id}:${s.status}:${s.externalId}:${s.lastSyncError}:${s.activeUntil}:${s.paymentNote}`,
        )
        .join("|")}`}
      client={payload}
      chatApiReady={Boolean(getChatApiConfig())}
      chatSsoReady={Boolean(getChatSsoConfig())}
      chatMissingKeys={chatApiMissingKeys()}
      totpEnabled={auth.user.totpEnabled}
    />
  );
}
