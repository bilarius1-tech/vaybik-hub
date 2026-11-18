import type { ClientStatus, ClientServiceStatus } from "@prisma/client";
import type { HubChatContractStatus } from "@/server/chat/hub-client";
import { dateToYmd, todayMskYmd } from "./period";

/** Client.status → желаемый ClientService.status при sync статуса клиента */
export function clientStatusToServiceStatus(
  status: ClientStatus,
): ClientServiceStatus {
  if (status === "paused") return "paused";
  if (status === "archived") return "off";
  return "active";
}

/**
 * Статус для контракта хаб→чат.
 * PAUSED/OFF из операционного статуса; иначе ACTIVE или EXPIRED по activeUntil (MSK).
 */
export function toChatContractStatus(input: {
  clientStatus: ClientStatus;
  serviceStatus: ClientServiceStatus;
  activeUntil: Date | null;
  todayYmd?: string;
}): HubChatContractStatus {
  if (
    input.clientStatus === "paused" ||
    input.serviceStatus === "paused"
  ) {
    return "PAUSED";
  }
  if (
    input.clientStatus === "archived" ||
    input.serviceStatus === "off"
  ) {
    return "OFF";
  }
  const until = dateToYmd(input.activeUntil);
  const today = input.todayYmd ?? todayMskYmd();
  if (until && until < today) return "EXPIRED";
  return "ACTIVE";
}

/** @deprecated используйте toChatContractStatus */
export function clientStatusToChat(
  status: ClientStatus,
): "active" | "paused" | "off" {
  if (status === "paused") return "paused";
  if (status === "archived") return "off";
  return "active";
}

export function resolveManageUrl(
  template: string | null | undefined,
  externalId: string | null | undefined,
): string | null {
  if (!template || !externalId) return null;
  if (!template.includes("{externalId}")) return template;
  return template.split("{externalId}").join(encodeURIComponent(externalId));
}
