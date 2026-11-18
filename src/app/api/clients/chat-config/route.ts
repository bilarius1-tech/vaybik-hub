import { requireCan } from "@/server/auth/require";
import {
  chatApiMissingKeys,
  getChatApiConfig,
  getChatSsoConfig,
} from "@/server/chat/config";
import { handleRouteError, jsonOk } from "@/server/http/response";

/** Публично для UI: готовность интеграции (без секретов). */
export async function GET() {
  try {
    await requireCan("clients.manage");
    const apiReady = Boolean(getChatApiConfig());
    const ssoReady = Boolean(getChatSsoConfig());
    return jsonOk({
      apiReady,
      ssoReady,
      missingApiKeys: chatApiMissingKeys(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}