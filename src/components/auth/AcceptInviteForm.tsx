"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
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

  return (
    <Card>
      <CardHeader title="Приглашение" subtitle="создайте пароль (≥ 12 символов)" />
      <form onSubmit={onSubmit}>
        <Field label="Имя" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Пароль" htmlFor="password">
          <Input
            id="password"
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? (
          <p className="mt-3 text-[13px] font-semibold text-rd">{error}</p>
        ) : null}
        <div className="mt-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Создаём…" : "Принять приглашение"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
