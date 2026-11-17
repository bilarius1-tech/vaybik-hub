import { BrandSettingsPanel } from "@/components/settings/BrandSettingsPanel";
import { Card, CardHeader } from "@/components/ui/Card";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import {
  brandSchema,
  contactsSchema,
  SETTINGS_KEYS,
  siteContentSchema,
} from "@/server/settings/schemas";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  try {
    await requireCan("settings.manage");
  } catch {
    redirect("/");
  }

  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          SETTINGS_KEYS.brand,
          SETTINGS_KEYS.content,
          SETTINGS_KEYS.contacts,
        ],
      },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <h2 className="mt-[10px] text-[16.5px] font-extrabold text-tx">
        Настройки Вайбика
      </h2>

      <div className="grid-g2">
        <Link href="/settings/notifications">
          <Card className="transition hover:border-ac">
            <CardHeader
              title="Уведомления Telegram"
              subtitle="правила, тест, анти-спам"
            />
          </Card>
        </Link>
        <Link href="/settings/chat-widget">
          <Card className="transition hover:border-ac">
            <CardHeader
              title="ИИ-консультант"
              subtitle="виджет chat.vaybik.ru на публичном сайте"
            />
          </Card>
        </Link>
      </div>

      <BrandSettingsPanel
        initialBrand={brandSchema.parse(map[SETTINGS_KEYS.brand] ?? {})}
        initialContent={siteContentSchema.parse(
          map[SETTINGS_KEYS.content] ?? {},
        )}
        initialContacts={contactsSchema.parse(
          map[SETTINGS_KEYS.contacts] ?? {},
        )}
      />
    </div>
  );
}
