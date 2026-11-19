"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await api<{
      needs2fa?: boolean;
      needsSetup2fa?: boolean;
      pendingToken?: string;
      redirectTo?: string;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    if (res.data?.needsSetup2fa) {
      router.push("/setup-2fa");
      router.refresh();
      return;
    }
    if (res.data?.needs2fa && res.data.pendingToken) {
      sessionStorage.setItem("vaybik_pending", res.data.pendingToken);
      router.push("/login/2fa");
      return;
    }
    router.push(res.data?.redirectTo || "/");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Вход в Вайбик" subtitle="панель управления" />
      <form onSubmit={onSubmit} className="space-y-1">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Пароль" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <label className="text-tx mt-3 flex items-center gap-2 text-[13px]">
          <input
            id="remember"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Запомнить меня
        </label>
        {error ? <p className="text-rd mt-3 text-[13px] font-semibold">{error}</p> : null}
        <div className="mt-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Входим…" : "Войти"}
          </Button>
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-mu">
          Забыли пароль? Напишите Вайбику:{" "}
          <a
            className="text-ac underline-offset-2 hover:underline"
            href="https://t.me/bilarius"
            target="_blank"
            rel="noopener noreferrer"
          >
            Telegram @bilarius
          </a>
          ,{" "}
          <a
            className="text-ac underline-offset-2 hover:underline"
            href="mailto:bilariuss@yandex.ru"
          >
            bilariuss@yandex.ru
          </a>
          ,{" "}
          <a
            className="text-ac underline-offset-2 hover:underline"
            href="https://max.ru/u/f9LHodD0cOJJqrzWNIgwcfSejU7L3YdJqC3eucYgoH12ooXijtHFm3XjPv4"
            target="_blank"
            rel="noopener noreferrer"
          >
            MAX
          </a>
          .
        </p>
      </form>
    </Card>
  );
}
