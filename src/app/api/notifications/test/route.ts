import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { sendTelegramMessage } from "@/server/services/telegram";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const body = z
      .object({
        chatId: z.string().min(1).optional(),
        text: z.string().min(1).default("Тест уведомлений Вайбик ✓"),
      })
      .parse(await req.json().catch(() => ({})));

    const chatId = body.chatId || process.env.TELEGRAM_DEFAULT_CHAT_ID;
    if (!chatId) {
      return jsonError("NO_CHAT", "Укажите chatId или TELEGRAM_DEFAULT_CHAT_ID", 400);
    }
    const result = await sendTelegramMessage(chatId, body.text);
    if (!result.ok && result.error?.includes("Токен")) {
      return jsonError("NO_TOKEN", result.error, 400);
    }
    await writeAudit({
      actorId: ctx.user.id,
      action: "notifications.test",
      entity: "Telegram",
      diff: { chatId, ok: result.ok },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    if (!result.ok) return jsonError("TELEGRAM", result.error || "Ошибка", 502);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
