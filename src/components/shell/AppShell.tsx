"use client";

import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar, type Period } from "@/components/shell/Topbar";
import { useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  envBadge?: string;
};

export function AppShell({ children, envBadge = "dev" }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("week");

  return (
    <div className="flex min-h-dvh">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/50 max-[950px]:block min-[951px]:hidden"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <main className="min-w-0 flex-1 px-[26px] pb-5 max-[950px]:px-4">
        <Topbar
          onMenuClick={() => setMenuOpen((v) => !v)}
          period={period}
          onPeriodChange={setPeriod}
          envBadge={envBadge}
        />
        <div className="pt-4">{children}</div>
      </main>
    </div>
  );
}
