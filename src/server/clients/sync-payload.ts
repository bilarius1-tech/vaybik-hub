import type { Client, ClientService } from "@prisma/client";
import type { UpsertHubClientInput } from "@/server/chat/hub-client";
import { dateToYmd } from "./period";
import { toChatContractStatus } from "./status-map";

export function buildChatUpsertPayload(
  client: Pick<Client, "id" | "name" | "status">,
  link: Pick<ClientService, "status" | "activeFrom" | "activeUntil" | "paymentNote">,
  todayYmd?: string,
): UpsertHubClientInput {
  return {
    hubClientId: client.id,
    name: client.name,
    status: toChatContractStatus({
      clientStatus: client.status,
      serviceStatus: link.status,
      activeUntil: link.activeUntil,
      todayYmd,
    }),
    activeFrom: dateToYmd(link.activeFrom),
    activeUntil: dateToYmd(link.activeUntil),
    paymentNote: link.paymentNote,
  };
}
