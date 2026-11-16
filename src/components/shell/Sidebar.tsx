"use client";

import { NAV_ITEMS, SIDEFOOT_ROWS } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onNavigate?: () => void;
  userEmail?: string;
  userRole?: string;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ open, onNavigate, userEmail, userRole }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const items =
    userRole === "PARTNER"
      ? NAV_ITEMS.filter((i) => i.href === "/" || i.href === "/profile")
      : NAV_ITEMS;

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 flex h-dvh w-[250px] shrink-0 flex-col gap-[18px] border-r border-bd bg-bg2 px-3.5 py-5",
        "max-[950px]:fixed max-[950px]:inset-y-0 max-[950px]:left-0 max-[950px]:transition-transform max-[950px]:duration-200",
        open ? "max-[950px]:translate-x-0" : "max-[950px]:-translate-x-full",
      )}
    >
      <div className="flex items-center gap-3 px-1">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-ac to-ac2 text-xl shadow-[0_4px_14px_color-mix(in_srgb,var(--ac)_33%,transparent)]"
          aria-hidden
          title="Плейсхолдер логотипа"
        >
          🐱
        </div>
        <div>
          <div className="text-[15px] font-extrabold leading-tight text-tx">
            Вайбик
          </div>
          <div className="text-[11.5px] text-mu">панель управления</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Основное меню">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-[9px] text-[13.5px] font-semibold text-mu transition-colors duration-150",
                "hover:bg-card hover:text-tx",
                active &&
                  "border border-[color-mix(in_srgb,var(--ac)_27%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--ac)_15%,transparent)] to-transparent text-tx",
              )}
            >
              <span
                className={cn(
                  "inline-flex w-[18px] justify-center text-[15px]",
                  active && "text-ac",
                )}
                aria-hidden
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/profile"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-[9px] text-[13.5px] font-semibold text-mu hover:bg-card hover:text-tx",
            isActive(pathname, "/profile") &&
              "border border-[color-mix(in_srgb,var(--ac)_27%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--ac)_15%,transparent)] to-transparent text-tx",
          )}
        >
          <span className="inline-flex w-[18px] justify-center">◉</span>
          Профиль
        </Link>
      </nav>

      <div className="space-y-2">
        {userEmail ? (
          <div className="truncate px-1 text-[11.5px] text-mu">{userEmail}</div>
        ) : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-md border border-bd bg-card px-3 py-2 text-left text-[12.5px] font-semibold text-mu hover:text-tx"
        >
          Выйти
        </button>
        <div className="rounded-xl border border-bd bg-card p-3">
          {SIDEFOOT_ROWS.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2 py-1 text-[12px]"
            >
              <span className="text-mu">{row.label}</span>
              <span className="font-bold text-tx">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
