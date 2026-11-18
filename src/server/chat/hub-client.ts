import { getChatApiConfig } from "./config";
import { signHubBody } from "./signature";

export type HubChatClientStatus = "active" | "paused" | "off";

export type UpsertHubClientInput = {
  hubClientId: string;
  name: string;
  status: HubChatClientStatus;
};

export type UpsertHubClientResult =
  | { ok: true; externalId: string }
  | { ok: false; code: string; message: string };

const TIMEOUT_MS = 12_000;

/**
 * POST {CHAT_BASE_URL}/api/hub/clients
 * Идемпотентный upsert по hubClientId. Секреты не логируем.
 */
export async function upsertHubChatClient(
  input: UpsertHubClientInput,
): Promise<UpsertHubClientResult> {
  const cfg = getChatApiConfig();
  if (!cfg) {
    return {
      ok: false,
      code: "CHAT_NOT_CONFIGURED",
      message:
        "Чат не настроен: задайте CHAT_BASE_URL и HUB_CHAT_API_SECRET в .env",
    };
  }

  const bodyObj = {
    hubClientId: input.hubClientId,
    name: input.name,
    status: input.status,
  };
  const rawBody = JSON.stringify(bodyObj);
  const signature = signHubBody(cfg.apiSecret, rawBody);
  const url = `${cfg.baseUrl}/api/hub/clients`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
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

  if (!res.ok) {
    return {
      ok: false,
      code: "CHAT_UNAVAILABLE",
      message: `Чат недоступен (HTTP ${res.status}). Повторите позже.`,
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      code: "CHAT_BAD_RESPONSE",
      message: "Чат вернул неверный ответ.",
    };
  }

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
