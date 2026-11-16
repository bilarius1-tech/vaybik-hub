import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionFromCookies } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const ctx = await getSessionFromCookies();
  if (ctx) {
    if (
      (ctx.user.role === "OWNER" || ctx.user.role === "ADMIN") &&
      !ctx.user.totpEnabled
    ) {
      redirect("/setup-2fa");
    }
    redirect("/");
  }
  return <LoginForm />;
}
