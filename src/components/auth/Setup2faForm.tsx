"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Insight } from "@/components/ui/Insight";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { email: string };

export function Setup2faForm({ email }: Props) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadQr() {
    setError(null);
    const res = await api<{ secret: string; qrDataUrl: string }>(
      "/api/auth/2fa/setup",
    );
    if (res.data) {
      setSecret(res.data.secret);
      setQr(res.data.qrDataUrl);
    } else if (res.error) {
      setError(res.error.message);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await api<{ backupCodes: string[] }>("/api/auth/2fa/setup", {
      method: "POST",
      body: JSON.stringify({ secret, code }),
    });
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setBackupCodes(res.data?.backupCodes ?? []);
  }

  if (backupCodes) {
    return (
      <Card>
        <CardHeader
          title="2FA включена"
          subtitle="сохраните резервные коды — они показываются один раз"
        />
        <ul className="grid grid-cols-2 gap-2 font-mono text-[13px]">
          {backupCodes.map((c) => (
            <li key={c} className="rounded-md border border-bd bg-bg2 px-2 py-1.5">
              {c}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button
            className="w-full"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
          >
            Перейти в панель
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Настройка 2FA" subtitle={`обязательна для ${email}`} />
      <Insight>
        Отсканируйте QR в приложении-аутентификаторе и введите код.
      </Insight>
      {!qr ? (
        <div className="my-4">
          <Button className="w-full" onClick={() => void loadQr()}>
            Сгенерировать QR
          </Button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR для TOTP" className="mx-auto my-4 rounded-md" />
          <p className="break-all text-center text-[11.5px] text-mu">{secret}</p>
        </>
      )}
      <form onSubmit={onSubmit}>
        <Field label="Код из приложения" htmlFor="code">
          <Input
            id="code"
            inputMode="numeric"
            required
            pattern="\d{6}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        {error ? (
          <p className="mt-3 text-[13px] font-semibold text-rd">{error}</p>
        ) : null}
        <div className="mt-4">
          <Button type="submit" className="w-full" disabled={loading || !secret}>
            {loading ? "Сохраняем…" : "Включить 2FA"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
