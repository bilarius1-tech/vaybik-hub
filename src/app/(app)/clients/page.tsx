import { ClientsList } from "@/components/clients/ClientsList";
import { requireCan } from "@/server/auth/require";
import { coerceYmd } from "@/lib/period-ymd";
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
  searchParams: Promise<{
    q?: string;
    status?: string;
    expiry?: string;
    sort?: string;
  }>;
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
  const expiry =
    sp.expiry === "expiring" || sp.expiry === "expired"
      ? sp.expiry
      : undefined;
  const sort =
    sp.sort === "until_asc" || sp.sort === "until_desc" || sp.sort === "created"
      ? sp.sort
      : "created";

  const clients = await listClients({ q: sp.q, status, expiry, sort });
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
      chatActiveUntil: coerceYmd(chat?.activeUntil ?? null),
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
      initialExpiry={expiry ?? "all"}
      initialSort={sort}
      chatApiReady={apiReady}
      chatMissingKeys={chatApiMissingKeys()}
      totpEnabled={auth.user.totpEnabled}
    />
  );
}
