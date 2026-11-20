import { NextRequest } from "next/server";
import { getHubChatApiSecret } from "@/server/chat/config";
import {
  landingClientBodySchema,
  registerLandingClient,
} from "@/server/chat/landing-clients";
import { verifyHubSignature } from "@/server/chat/signature";
import { clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

/**
 * Chat → Hub: активация DEMO→ACTIVE с лендинга.
 * Auth: X-Hub-Signature (HUB_CHAT_API_SECRET), без сессии.
 * См. docs/services/CONTRACT.md §4b.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = getHubChatApiSecret();
    if (!secret) {
      return jsonError(
        "HUB_NOT_CONFIGURED",
        "HUB_CHAT_API_SECRET не задан",
        503,
      );
    }

    const rawBody = await req.text();
    const sig = req.headers.get("x-hub-signature") ?? "";
    if (!verifyHubSignature(secret, rawBody, sig)) {
      return jsonError("UNAUTHORIZED", "Неверная подпись", 401);
    }

    let parsedJson: unknown;
    try {
      parsedJson = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      return jsonError("VALIDATION", "Некорректный JSON", 400);
    }

    const body = landingClientBodySchema.parse(parsedJson);
    const result = await registerLandingClient(body, {
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    if (!result.ok) {
      return jsonError(result.code, result.message, result.status);
    }

    return jsonOk({ hubClientId: result.hubClientId });
  } catch (err) {
    return handleRouteError(err);
  }
}
