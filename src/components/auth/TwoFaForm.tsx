"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

function readPending(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("vaybik_pending");
}

export function TwoFaForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending] = useState<string | null>(() => readPending());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (typeof window !== "undefined" && !pending) {
    router.replace("/login");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setError(null);
    setLoading(true);
    const res = await api("/api/auth/2fa", {
      method: "POST",
      body: JSON.stringify({ pendingToken: pending, code }),
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    sessionStorage.removeItem("vaybik_pending");
    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Двухфакторная аутентификация"
        subtitle="код из приложения или резервный"
      />
      <form onSubmit={onSubmit}>
        <Field label="Код" htmlFor="code">
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
        </Field>
        {error ? (
          <p className="mt-3 text-[13px] font-semibold text-rd">{error}</p>
        ) : null}
        <div className="mt-4">
          <Button type="submit" className="w-full" disabled={loading || !pending}>
            {loading ? "Проверяем…" : "Подтвердить"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
