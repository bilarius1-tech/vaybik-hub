import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Insight } from "@/components/ui/Insight";
import { Kpi } from "@/components/ui/Kpi";
import { Pill } from "@/components/ui/Pill";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section id="sec-kpi">
        <h2 className="mb-3 mt-[10px] text-[16.5px] font-extrabold text-tx">
          Дашборд
        </h2>
        <div className="grid-k5">
          <Kpi label="Сервисов онлайн" value="—/—" tone="ok" />
          <Kpi label="Заявок сегодня" value="—" tone="ok" />
          <Kpi label="Визиты" value="—" tone="ok" />
          <Kpi label="CPU / RAM" value="—" tone="warn" />
          <Kpi label="До сертификата" value="—" tone="ok" />
        </div>
      </section>

      <section id="sec-alerts" className="grid-g2">
        <Alert title="Внимание" tone="warn">
          Данные появятся после Фазы 1. Сейчас каркас и демо-компоненты.
        </Alert>
        <Card>
          <CardHeader
            title="Сервисы"
            subtitle="реестр подключится в MVP"
            action={<Pill tone="demo">демо</Pill>}
          />
          <EmptyState
            title="Пока нет сервисов"
            description="Добавьте первый сервис в разделе «Сервисы» после auth."
            className="border-none bg-transparent py-8"
          />
        </Card>
      </section>

      <Insight>
        <strong>Фаза 0.</strong> Каркас готов: AppShell, токены, Prisma, CI.
        Авторизация и живые метрики — в Фазе 1.
      </Insight>
    </div>
  );
}
