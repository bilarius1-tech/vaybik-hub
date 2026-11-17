import { ChatWidgetPanel } from "@/components/settings/ChatWidgetPanel";
import {
  CHAT_WIDGET_SETTING_KEY,
  parseChatWidget,
} from "@/server/cms/chat-widget";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export default async function ChatWidgetSettingsPage() {
  try {
    await requireCan("settings.manage");
  } catch {
    redirect("/");
  }

  const row = await prisma.setting.findUnique({
    where: { key: CHAT_WIDGET_SETTING_KEY },
  });
  const widget = parseChatWidget(row?.value);

  return (
    <div className="space-y-6">
      <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
        ИИ-консультант
      </h2>
      <ChatWidgetPanel initial={widget} />
    </div>
  );
}
