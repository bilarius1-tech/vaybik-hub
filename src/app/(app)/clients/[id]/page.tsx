import { ClientDetail } from "@/components/clients/ClientDetail";
import { requireCan } from "@/server/auth/require";
import { getClientAccess } from "@/server/clients/access";
import { dateToYmd } from "@/server/clients/period";
import { getClient } from "@/server/clients/service";
import {
  chatApiMissingKeys,
  getChatApiConfig,
  getChatSsoConfig,
} from "@/server/chat/config";
import { resolveChatManageSsoHref } from "@/server/chat/studio-sso";
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
    // Сразу YYYY-MM-DD — чтобы date-input и save не теряли срок после refresh
    activeFrom: dateToYmd(cs.activeFrom),
    activeUntil: dateToYmd(cs.activeUntil),
    manageHref: resolveChatManageSsoHref(
      cs.service.manageUrl,
      cs.externalId,
    ),
  }));

  const access = await getClientAccess(id);
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
            `${s.id}:${s.status}:${s.externalId}:${s.lastSyncError}:${dateToYmd(s.activeUntil)}:${s.paymentNote}`,
        )
        .join("|")}`}
      client={payload}
      initialAccess={JSON.parse(JSON.stringify(access))}
      chatApiReady={Boolean(getChatApiConfig())}
      chatSsoReady={Boolean(getChatSsoConfig())}
      chatMissingKeys={chatApiMissingKeys()}
      totpEnabled={auth.user.totpEnabled}
    />
  );
}
