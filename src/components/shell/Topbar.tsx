"use client";

import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { StatusDot } from "@/components/ui/StatusDot";
import { useTheme } from "@/components/theme/ThemeProvider";
import { formatDateTime } from "@/lib/format";
import { useEffect, useState } from "react";

export type Period = "day" | "week" | "month";

type Props = {
  onMenuClick: () => void;
  period: Period;
  onPeriodChange: (p: Period) => void;
  envBadge: string;
};

export function Topbar({
  onMenuClick,
  period,
  onPeriodChange,
  envBadge,
}: Props) {
  const { toggleMode } = useTheme();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-bd bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-[10px]">
      <div className="flex flex-col gap-3 px-0 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="hidden rounded-md border border-bd bg-card px-3 py-1.5 text-[13px] font-semibold text-tx max-[950px]:inline-flex"
            onClick={onMenuClick}
            aria-label="Открыть меню"
          >
            ☰
          </button>
          <StatusDot status="up" pulse label={`данные на ${formatDateTime(now)}`} />
          <Pill tone="demo">демо</Pill>
          <Pill tone={envBadge === "prod" ? "red" : "accent"}>
            {envBadge === "prod" ? "prod" : "dev"}
          </Pill>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            aria-label="Период"
            value={period}
            onChange={onPeriodChange}
            options={[
              { value: "day", label: "День" },
              { value: "week", label: "Неделя" },
              { value: "month", label: "Месяц" },
            ]}
          />
          <Button variant="ghost" size="sm" onClick={toggleMode}>
            ◐ Тема
          </Button>
        </div>
      </div>
    </header>
  );
}
