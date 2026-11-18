/** Подписи статусов клиента и подключения (значения в БД не меняем). */

export type ClientStatusCode = "active" | "paused" | "archived";
export type ClientServiceStatusCode = "setup" | "active" | "paused" | "off";

export const CLIENT_STATUS_LABEL: Record<ClientStatusCode, string> = {
  active: "Активен",
  paused: "На паузе",
  archived: "Архив",
};

export const SERVICE_STATUS_LABEL: Record<ClientServiceStatusCode, string> = {
  setup: "Настройка",
  active: "Активен",
  paused: "На паузе",
  off: "Отключён",
};

/** Контрактный EXPIRED (не хранится в ClientService.status). */
export const EXPIRED_LABEL = "Срок истёк";

export function clientStatusLabel(code: string): string {
  return CLIENT_STATUS_LABEL[code as ClientStatusCode] ?? code;
}

export function serviceStatusLabel(code: string): string {
  if (code === "EXPIRED" || code === "expired") return EXPIRED_LABEL;
  return SERVICE_STATUS_LABEL[code as ClientServiceStatusCode] ?? code;
}
