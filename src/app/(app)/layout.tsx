import { AppShell } from "@/components/shell/AppShell";
import { enforce2faGate, requirePageSession } from "@/server/auth/gate";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await requirePageSession();
  await enforce2faGate(user);
  const envBadge = process.env.APP_ENV === "prod" ? "prod" : "dev";
  return (
    <AppShell envBadge={envBadge} userEmail={user.email} userRole={user.role}>
      {children}
    </AppShell>
  );
}
