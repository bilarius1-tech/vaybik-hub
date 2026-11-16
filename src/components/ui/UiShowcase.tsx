"use client";

import {
  Alert,
  Button,
  CalcCard,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  Insight,
  Kpi,
  Pill,
  Select,
  Segmented,
  Skeleton,
  Sparkline,
  StatusDot,
} from "@/components/ui";
import { useTheme, type ThemeVariant } from "@/components/theme/ThemeProvider";
import { useState } from "react";

type DemoRow = {
  id: string;
  name: string;
  status: "up" | "down" | "degraded";
  ms: number;
  spark: number[];
};

const rows: DemoRow[] = [
  {
    id: "1",
    name: "chat.vaybik.ru",
    status: "up",
    ms: 42,
    spark: [40, 38, 45, 42, 39, 41, 44],
  },
  {
    id: "2",
    name: "lead.vaybik.ru",
    status: "degraded",
    ms: 210,
    spark: [80, 120, 90, 200, 180, 210, 190],
  },
  {
    id: "3",
    name: "region.vaybik.ru",
    status: "down",
    ms: 0,
    spark: [50, 48, 0, 0, 0, 0, 0],
  },
];

export function UiShowcase() {
  const { variant, setVariant } = useTheme();
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");

  return (
    <div className="space-y-8 pb-10">
      <section>
        <h2 className="mb-3 mt-[10px] text-[16.5px] font-extrabold text-tx">
          Витрина UI
        </h2>
        <p className="mb-4 text-[13px] text-mu">
          Только в development. Демо-данные помечены бейджем.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone="demo">демо</Pill>
          <Segmented
            aria-label="Вариант темы"
            value={variant}
            onChange={(v) => setVariant(v as ThemeVariant)}
            options={[
              { value: "A", label: "A" },
              { value: "B", label: "B" },
              { value: "C", label: "C" },
            ]}
          />
          <Segmented
            aria-label="Период"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "day", label: "День" },
              { value: "week", label: "Неделя" },
              { value: "month", label: "Месяц" },
            ]}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[16.5px] font-extrabold text-tx">KPI</h2>
        <div className="grid-k4">
          <Kpi label="Онлайн" value="5/6" delta="+1" tone="ok" />
          <Kpi label="Заявки" value="12" delta="+3" tone="ok" />
          <Kpi label="CPU" value="18%" tone="warn" />
          <Kpi label="Диск" value="81%" delta="+4%" tone="bad" />
        </div>
      </section>

      <section className="grid-g2">
        <Alert title="Сертификат истекает" tone="warn">
          region.vaybik.ru — осталось 12 дней.
        </Alert>
        <Alert title="Сервис упал" tone="bad">
          region.vaybik.ru не отвечает 3 проверки подряд.
        </Alert>
      </section>

      <section>
        <Card>
          <CardHeader
            title="Таблица сервисов"
            subtitle="DataTable + StatusDot + Sparkline"
            action={<Pill tone="demo">демо</Pill>}
          />
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "name",
                header: "Сервис",
                render: (r) => (
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <StatusDot status={r.status} />
                    {r.name}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Статус",
                render: (r) => (
                  <Pill
                    tone={
                      r.status === "up"
                        ? "green"
                        : r.status === "degraded"
                          ? "yellow"
                          : "red"
                    }
                  >
                    {r.status === "up"
                      ? "онлайн"
                      : r.status === "degraded"
                        ? "деградация"
                        : "упал"}
                  </Pill>
                ),
              },
              {
                key: "ms",
                header: "мс",
                render: (r) => (r.ms ? r.ms.toLocaleString("ru-RU") : "—"),
              },
              {
                key: "spark",
                header: "24ч",
                render: (r) => <Sparkline values={r.spark} />,
              },
            ]}
          />
        </Card>
      </section>

      <section className="grid-g3">
        <CalcCard />
        <Card>
          <CardHeader title="Формы" subtitle="Field / Input / Select" />
          <Field label="Email" htmlFor="ui-email">
            <Input id="ui-email" placeholder="owner@vaybik.ru" />
          </Field>
          <Field label="Роль" htmlFor="ui-role">
            <Select id="ui-role" defaultValue="admin">
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="partner">partner</option>
            </Select>
          </Field>
          <div className="mt-4 flex gap-2">
            <Button>Сохранить</Button>
            <Button variant="ghost">Отмена</Button>
            <Button variant="danger" size="sm">
              Удалить
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Состояния" />
          <div className="space-y-3">
            <Insight>
              <strong>Инсайт:</strong> среднее время ответа выросло на 12% за
              неделю.
            </Insight>
            <div className="flex flex-wrap gap-2">
              <StatusDot status="up" label="up" />
              <StatusDot status="degraded" label="degraded" pulse={false} />
              <StatusDot status="down" label="down" pulse={false} />
              <StatusDot status="unknown" label="unknown" pulse={false} />
            </div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </Card>
      </section>

      <EmptyState
        title="Пустое состояние"
        description="Когда данных ещё нет — показываем EmptyState."
        action={<Button variant="ghost">Добавить</Button>}
      />
    </div>
  );
}
