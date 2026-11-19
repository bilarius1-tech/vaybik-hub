"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Preview =
  | {
      kind: "client";
      valid: boolean;
      email: string | null;
      clientName: string;
      passwordMin: number;
      emailFixed: boolean;
    }
  | {
      kind: "staff";
      valid: boolean;
      email: string;
      role: string;
      passwordMin: number;
      emailFixed: boolean;
    };

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<Preview>(
        `/api/client-invites/preview?token=${encodeURIComponent(token)}`,
      );
      if (cancelled) return;
      if (res.error || !res.data) {
        setLoadError(res.error?.message || "Приглашение не найдено");
        return;
      }
      setPreview(res.data);
      if (res.data.email) setEmail(res.data.email);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview?.valid) return;
    setLoading(true);
    setError(null);

    if (preview.kind === "client") {
      const res = await api<{ redirectTo?: string }>(
        "/api/client-invites/accept",
        {
          method: "POST",
          body: JSON.stringify({
            token,
            name: name || undefined,
            email: preview.emailFixed ? undefined : email,
            password,
          }),
        },
      );
      setLoading(false);
      if (res.error) {
        setError(res.error.message);
        return;
      }
      router.push(res.data?.redirectTo || "/my-services");
      router.refresh();
      return;
    }

    const res = await api<{ needsSetup2fa?: boolean }>("/api/invites/accept", {
      method: "POST",
      body: JSON.stringify({ token, name: name || undefined, password }),
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    router.push(res.data?.needsSetup2fa ? "/setup-2fa" : "/");
    router.refresh();
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader title="Приглашение" subtitle={loadError} />
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card>
        <CardHeader title="Приглашение" subtitle="загрузка…" />
      </Card>
    );
  }

  if (!preview.valid) {
    return (
      <Card>
        <CardHeader
          title="Приглашение"
          subtitle="ссылка недействительна, истекла или отозвана"
        />
      </Card>
    );
  }

  const min = preview.passwordMin;
  const subtitle =
    preview.kind === "client"
      ? `доступ к «${preview.clientName}» · пароль ≥ ${min} символов`
      : `роль ${preview.role} · пароль ≥ ${min} символов`;

  return (
    <Card>
      <CardHeader title="Приглашение" subtitle={subtitle} />
      <form onSubmit={onSubmit}>
        {preview.kind === "client" && !preview.emailFixed ? (
          <Field label="Email (логин)" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Email" htmlFor="email-ro">
            <Input id="email-ro" value={email} readOnly disabled />
          </Field>
        )}
        <Field label="Имя" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Пароль" htmlFor="password">
          <Input
            id="password"
            type="password"
            required
            minLength={min}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? (
          <p className="mt-3 text-[13px] font-semibold text-rd">{error}</p>
        ) : null}
        <div className="mt-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Создаём…" : "Принять и войти"}
          </Button>
        </div>
        <p className="mt-3 text-[12px] text-mu">
          После этого войдите в обычный вход по email и паролю, если сессия
          сбросится.
        </p>
      </form>
    </Card>
  );
}
