import { prisma } from "@/server/db";
import { resolveTelegramBotToken } from "@/server/vault/service";

async function botToken(): Promise<string | null> {
  return resolveTelegramBotToken();
}

function defaultChatId(): string | null {
  return process.env.TELEGRAM_DEFAULT_CHAT_ID || null;
}

function inQuietHours(
  quietStart: string | null | undefined,
  quietEnd: string | null | undefined,
): boolean {
  if (!quietStart || !quietEnd) return false;
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }),
  );
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = quietStart.split(":").map(Number);
  const [eh, em] = quietEnd.split(":").map(Number);
  const start = (sh || 0) * 60 + (sm || 0);
  const end = (eh || 0) * 60 + (em || 0);
  if (start === end) return false;
  if (start < end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await botToken();
  if (!token) {
    return { ok: false, error: "Токен бота не найден (vault telegram_bot или TELEGRAM_BOT_TOKEN)" };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Telegram HTTP ${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}

export async function notifyEvent(params: {
  event: string;
  entityId?: string | null;
  text: string;
}): Promise<void> {
  const rules = await prisma.notificationRule.findMany({
    where: { event: params.event, isActive: true },
  });

  const fallbackChat = defaultChatId();
  const targets =
    rules.length > 0
      ? rules
      : fallbackChat
        ? [
            {
              id: "env-default",
              event: params.event,
              chatIds: [fallbackChat],
              isActive: true,
              throttleMin: 10,
              quietStart: null as string | null,
              quietEnd: null as string | null,
            },
          ]
        : [];

  for (const rule of targets) {
    if (inQuietHours(rule.quietStart, rule.quietEnd)) continue;

    const throttleKey = `${params.event}:${params.entityId || "*"}:${rule.id}`;
    const prev = await prisma.notificationThrottle.findUnique({
      where: { key: throttleKey },
    });
    const minGap = (rule.throttleMin || 10) * 60_000;
    if (prev && Date.now() - prev.lastSentAt.getTime() < minGap) continue;

    for (const chatId of rule.chatIds) {
      const result = await sendTelegramMessage(chatId, params.text);
      if (result.ok) {
        await prisma.notificationThrottle.upsert({
          where: { key: throttleKey },
          create: { key: throttleKey, lastSentAt: new Date() },
          update: { lastSentAt: new Date() },
        });
      } else {
        console.warn("[telegram]", result.error);
      }
    }
  }
}
