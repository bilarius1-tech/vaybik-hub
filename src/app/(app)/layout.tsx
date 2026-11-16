import { AppShell } from "@/components/shell/AppShell";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const envBadge = process.env.APP_ENV === "prod" ? "prod" : "dev";
  return <AppShell envBadge={envBadge}>{children}</AppShell>;
}
