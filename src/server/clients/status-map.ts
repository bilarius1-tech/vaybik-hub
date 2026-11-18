import type { ClientStatus, ClientServiceStatus } from "@prisma/client";
import type { HubChatClientStatus } from "@/server/chat/hub-client";

/** Client.status → статус в API чата */
export function clientStatusToChat(status: ClientStatus): HubChatClientStatus {
  if (status === "paused") return "paused";
  if (status === "archived") return "off";
  return "active";
}

/** Client.status → желаемый ClientService.status при sync статуса клиента */
export function clientStatusToServiceStatus(
  status: ClientStatus,
): ClientServiceStatus {
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
