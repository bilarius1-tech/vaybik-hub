import { Card, CardHeader } from "@/components/ui/Card";
import Link from "next/link";

export default function SettingsPage() {
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
        <Card>
          <CardHeader
            title="Бренд и контент"
            subtitle="появится в следующей части фазы 1"
          />
        </Card>
      </div>
    </div>
  );
}
