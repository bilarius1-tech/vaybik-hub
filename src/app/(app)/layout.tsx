import { AppShell } from "@/components/shell/AppShell";
import { enforce2faGate, requirePageSession } from "@/server/auth/gate";
import { can } from "@/server/auth/rbac";
import { getChatSsoConfig } from "@/server/chat/config";
import { getLeadsSsoConfig } from "@/server/leads/config";
import { studioCabinetLinks } from "@/lib/studio-service-links";
import { getDashboardSummary } from "@/server/services/dashboard";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await requirePageSession();
  await enforce2faGate(user);
  const envBadge = process.env.APP_ENV === "prod" ? "prod" : "dev";

  let sidefoot =
    user.role === "CLIENT"
      ? [
          { label: "Кабинет", value: "клиент" },
          { label: "Сервисы", value: "мои" },
          { label: "Поддержка", value: "Вайбик" },
        ]
      : [
          { label: "Сервисов онлайн", value: "—" },
          { label: "CPU / RAM", value: "—" },
          { label: "Диск", value: "—" },
        ];
  if (can(user, "services.manage")) {
    try {
      const summary = await getDashboardSummary("day", { lite: true });
      sidefoot = summary.sidefoot;
    } catch {
      /* ignore */
    }
  }

  const cabinets =
    can(user, "services.manage")
      ? studioCabinetLinks({
          chatSsoReady: Boolean(getChatSsoConfig()),
          leadsSsoReady: Boolean(getLeadsSsoConfig()),
        })
      : [];

  return (
    <AppShell
      envBadge={envBadge}
      userEmail={user.email}
      userRole={user.role}
      sidefoot={sidefoot}
      cabinets={cabinets}
    >
      {children}
    </AppShell>
  );
}
