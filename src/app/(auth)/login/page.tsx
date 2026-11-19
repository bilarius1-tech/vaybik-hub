import { LoginForm } from "@/components/auth/LoginForm";
import { sanitizeHubNext } from "@/server/auth/safe-next";
import { getSessionFromCookies } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = sanitizeHubNext(sp.next);

  const ctx = await getSessionFromCookies();
  if (ctx) {
    if (
      (ctx.user.role === "OWNER" || ctx.user.role === "ADMIN") &&
      !ctx.user.totpEnabled
    ) {
      redirect("/setup-2fa");
    }
    if (ctx.user.role === "CLIENT") {
      redirect(next && next.startsWith("/my-services") ? next : "/my-services");
    }
    redirect(next || "/");
  }
  return <LoginForm next={next} />;
}
