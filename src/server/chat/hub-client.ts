import { getChatApiConfig } from "./config";
import { signHubBody } from "./signature";

/** Статус в контракте хаб→чат (UPPERCASE). */
export type HubChatContractStatus = "ACTIVE" | "PAUSED" | "EXPIRED" | "OFF";

/** @deprecated legacy lowercase — только для обратной совместимости тестов */
export type HubChatClientStatus = "active" | "paused" | "off";

export type UpsertHubClientInput = {
  hubClientId: string;
  name: string;
  status: HubChatContractStatus;
  activeFrom?: string | null;
  activeUntil?: string | null;
  paymentNote?: string | null;
};

export type UpsertHubClientResult =
  | { ok: true; externalId: string }
  | { ok: false; code: string; message: string };

export type DeleteHubClientResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

const TIMEOUT_MS = 12_000;

async function signedJson(
  method: "POST" | "DELETE",
  path: string,
  bodyObj: Record<string, unknown>,
): Promise<
  | { ok: true; json: unknown; status: number }
  | { ok: false; code: string; message: string }
> {
  const cfg = getChatApiConfig();
  if (!cfg) {
    return {
      ok: false,
      code: "CHAT_NOT_CONFIGURED",
      message:
        "Чат не настроен: задайте CHAT_BASE_URL и HUB_CHAT_API_SECRET в .env",
    };
  }

  const rawBody = JSON.stringify(bodyObj);
  const signature = signHubBody(cfg.apiSecret, rawBody);
  const url = `${cfg.baseUrl}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature": signature,
        Accept: "application/json",
      },
      body: rawBody,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return {
      ok: false,
      code: "CHAT_UNAVAILABLE",
      message: "Чат недоступен. Проверьте сеть или повторите позже.",
    };
  }

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const msg =
      json &&
      typeof json === "object" &&
      "error" in json &&
      json.error &&
      typeof json.error === "object" &&
      "message" in json.error &&
      typeof (json.error as { message: unknown }).message === "string"
        ? (json.error as { message: string }).message
        : `Чат недоступен (HTTP ${res.status}). Повторите позже.`;
    return {
      ok: false,
      code: res.status === 404 ? "CHAT_NOT_FOUND" : "CHAT_UNAVAILABLE",
      message: msg,
    };
  }

  return { ok: true, json, status: res.status };
}

/**
 * POST {CHAT_BASE_URL}/api/hub/clients
 * Идемпотентный upsert по hubClientId. Секреты не логируем.
 *
 * Контракт: status ACTIVE|PAUSED|EXPIRED|OFF; activeFrom/activeUntil YYYY-MM-DD;
 * paymentNote — свободный текст оплаты.
 */
export async function upsertHubChatClient(
  input: UpsertHubClientInput,
): Promise<UpsertHubClientResult> {
  const bodyObj: Record<string, unknown> = {
    hubClientId: input.hubClientId,
    name: input.name,
    status: input.status,
  };
  if (input.activeFrom !== undefined) bodyObj.activeFrom = input.activeFrom;
  if (input.activeUntil !== undefined) bodyObj.activeUntil = input.activeUntil;
  if (input.paymentNote !== undefined) bodyObj.paymentNote = input.paymentNote;

  const res = await signedJson("POST", "/api/hub/clients", bodyObj);
  if (!res.ok) return res;

  const json = res.json;
  const externalId =
    json &&
    typeof json === "object" &&
    "externalId" in json &&
    typeof (json as { externalId: unknown }).externalId === "string"
      ? (json as { externalId: string }).externalId.trim()
      : "";

  if (!externalId) {
    return {
      ok: false,
      code: "CHAT_BAD_RESPONSE",
      message: "Чат не вернул externalId.",
    };
  }

  return { ok: true, externalId };
}

/**
 * DELETE {CHAT_BASE_URL}/api/hub/clients
 * Чат делает бэкап среза и удаляет клиента. Идемпотентно: нет клиента → ok.
 */
export async function deleteHubChatClient(input: {
  hubClientId: string;
}): Promise<DeleteHubClientResult> {
  const res = await signedJson("DELETE", "/api/hub/clients", {
    hubClientId: input.hubClientId,
  });
  if (!res.ok) return res;
  return { ok: true };
}
