"use client";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useState } from "react";

type Props = {
  clientId: string;
  enabled: boolean;
  totpEnabled?: boolean;
  variant?: "primary" | "ghost";
  label?: string;
  className?: string;
  onError?: (message: string) => void;
};

/**
 * «Войти как клиент»: сразу SSO, если reauth свежий; иначе модалка пароля.
 * Токен в state не кладём.
 */
export function ImpersonateControls({
  clientId,
  enabled,
  totpEnabled = false,
  variant = "ghost",
  label = "Войти как клиент",
  className,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthCode, setReauthCode] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);

  async function tryImpersonateRedirect(): Promise<"ok" | "reauth" | "error"> {
    try {
      const res = await fetch(`/admin/api/clients/${clientId}/impersonate`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = (await res.json().catch(() => null)) as {
        redirectUrl?: string;
        error?: { message?: string; code?: string };
      } | null;
      if (res.ok && typeof json?.redirectUrl === "string" && json.redirectUrl) {
        window.location.assign(json.redirectUrl);
        return "ok";
      }
      if (json?.error?.code === "REAUTH_REQUIRED") return "reauth";
      const msg = json?.error?.message || "Не удалось войти как клиент";
      onError?.(msg);
      setReauthError(msg);
      return "error";
    } catch {
      const msg = "Не удалось войти как клиент";
      onError?.(msg);
      setReauthError(msg);
      return "error";
    }
  }

  async function start() {
    if (!enabled) return;
    setBusy(true);
    setReauthError(null);
    const result = await tryImpersonateRedirect();
    if (result === "reauth") {
      setReauthPassword("");
      setReauthCode("");
      setReauthError(null);
      setReauthOpen(true);
    }
    setBusy(false);
  }

  async function confirmReauthAndGo() {
    setBusy(true);
    setReauthError(null);
    const res = await api("/api/auth/reauth", {
      method: "POST",
      body: JSON.stringify({
        password: reauthPassword,
        code: reauthCode || undefined,
      }),
    });
    if (res.error) {
      setReauthError(res.error.message);
      setBusy(false);
      return;
    }
    setReauthOpen(false);
    setReauthPassword("");
    setReauthCode("");
    await tryImpersonateRedirect();
    setBusy(false);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={busy || !enabled}
        title={
          enabled
            ? "SSO в чат (если давно не вводили пароль — спросим)"
            : "Нужны подключение Чата с externalId и SSO-ключи"
        }
        onClick={(e) => {
          e.stopPropagation();
          void start();
        }}
      >
        {busy ? "…" : label}
      </Button>

      <ConfirmDialog
        open={reauthOpen}
        title="Подтвердите пароль"
        confirmLabel="Войти"
        busy={busy}
        onCancel={() => {
          if (busy) return;
          setReauthOpen(false);
          setReauthPassword("");
          setReauthCode("");
          setReauthError(null);
        }}
        onConfirm={() => void confirmReauthAndGo()}
      >
        <p className="mb-3">
          Чтобы войти в чат как клиент, подтвердите пароль админки.
        </p>
        <Field label="Пароль" htmlFor={`impersonate-pass-${clientId}`}>
          <Input
            id={`impersonate-pass-${clientId}`}
            type="password"
            autoComplete="current-password"
            value={reauthPassword}
            onChange={(e) => setReauthPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirmReauthAndGo();
            }}
          />
        </Field>
        {totpEnabled ? (
          <Field label="Код 2FA" htmlFor={`impersonate-totp-${clientId}`}>
            <Input
              id={`impersonate-totp-${clientId}`}
              value={reauthCode}
              onChange={(e) => setReauthCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </Field>
        ) : null}
        {reauthError ? (
          <p className="mt-2 text-[13px] text-rd">{reauthError}</p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
