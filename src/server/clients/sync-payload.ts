import type { Client, ClientService } from "@prisma/client";
import type { UpsertHubClientInput } from "@/server/chat/hub-client";
import { dateToYmd } from "./period";
import { toChatContractStatus } from "./status-map";

/**
 * Собрать тело upsert в чат.
 * includePeriodNulls=true — при сохранении срока можно очистить даты (null в теле).
 * иначе null-даты не кладём в payload, чтобы sync имени/статуса не затирал срок в чате.
 */
export function buildChatUpsertPayload(
  client: Pick<Client, "id" | "name" | "status">,
  link: Pick<
    ClientService,
    "status" | "activeFrom" | "activeUntil" | "paymentNote"
  >,
  opts?: { todayYmd?: string; includePeriodNulls?: boolean },
): UpsertHubClientInput {
  const activeFrom = dateToYmd(link.activeFrom);
  const activeUntil = dateToYmd(link.activeUntil);
  const paymentNote = link.paymentNote;
  const includeNulls = opts?.includePeriodNulls === true;

  const payload: UpsertHubClientInput = {
    hubClientId: client.id,
    name: client.name,
    status: toChatContractStatus({
      clientStatus: client.status,
      serviceStatus: link.status,
      activeUntil: link.activeUntil,
      todayYmd: opts?.todayYmd,
    }),
  };

  if (includeNulls || activeFrom != null) payload.activeFrom = activeFrom;
  if (includeNulls || activeUntil != null) payload.activeUntil = activeUntil;
  if (includeNulls || paymentNote != null) payload.paymentNote = paymentNote;

  return payload;
}
