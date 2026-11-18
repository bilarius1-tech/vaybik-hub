"use client";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  clientId: string;
  clientName: string;
  totpEnabled?: boolean;
  incomplete?: boolean;
  incompleteError?: string | null;
  variant?: "danger" | "ghost";
  onError?: (message: string) => void;
};

/**
 * Удаление клиента: ввод названия + reauth (как impersonate).
 */
export function DeleteClientControls({
  clientId,
  clientName,
  totpEnabled = false,
  incomplete = false,
  incompleteError,
  variant = "danger",
  onError,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete(): Promise<"ok" | "reauth" | "error"> {
    try {
      const res = await fetch(`/admin/api/clients/${clientId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string; code?: string; incomplete?: boolean };
        deleted?: boolean;
      } | null;
      if (res.ok && json?.deleted) {
        router.push("/clients");
        router.refresh();
        return "ok";
      }
      if (json?.error?.code === "REAUTH_REQUIRED") return "reauth";
      const msg =
        json?.error?.message ||
        (json?.error?.incomplete
          ? "Удаление не завершено — сервис не ответил"
          : "Не удалось удалить клиента");
      setError(msg);
      onError?.(msg);
      if (json?.error?.incomplete) router.refresh();
      return "error";
    } catch {
      const msg = "Не удалось удалить клиента";
      setError(msg);
      onError?.(msg);
      return "error";
    }
  }

  async function confirm() {
    if (confirmName.trim() !== clientName) {
      setError("Введите название клиента точно как в карточке");
      return;
    }
    if (!password.trim()) {
      setError("Введите пароль");
      return;
    }
    setBusy(true);
    setError(null);

    const re = await api("/api/auth/reauth", {
      method: "POST",
      body: JSON.stringify({
        password,
        code: code || undefined,
      }),
    });
    if (re.error) {
      setError(re.error.message);
      setBusy(false);
      return;
    }

    const result = await doDelete();
    setBusy(false);
    if (result === "ok") setOpen(false);
    if (result === "reauth") {
      setError("Сессия подтверждения истекла — введите пароль ещё раз");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          setConfirmName("");
          setPassword("");
          setCode("");
          setError(null);
          setOpen(true);
        }}
      >
        {incomplete ? "Повторить удаление" : "Удалить клиента"}
      </Button>
      {incomplete && incompleteError ? (
        <p className="mt-1 text-[12px] text-rd">
          Удаление не завершено: {incompleteError}
        </p>
      ) : null}

      <ConfirmDialog
        open={open}
        title={incomplete ? "Повторить удаление" : "Удалить клиента"}
        confirmLabel="Удалить"
        danger
        busy={busy}
        onCancel={() => {
          if (busy) return;
          setOpen(false);
        }}
        onConfirm={() => void confirm()}
      >
        <p className="mb-3">
          Сначала бэкап хаба, затем удаление в подключённых сервисах (Чат — со
          своим бэкапом). В хабе клиент исчезнет только после успеха. Для
          подтверждения введите название{" "}
          <span className="font-semibold text-tx">{clientName}</span> и пароль.
        </p>
        <Field label="Название клиента" htmlFor={`del-name-${clientId}`}>
          <Input
            id={`del-name-${clientId}`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Пароль" htmlFor={`del-pass-${clientId}`}>
          <Input
            id={`del-pass-${clientId}`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {totpEnabled ? (
          <Field label="Код 2FA" htmlFor={`del-totp-${clientId}`}>
            <Input
              id={`del-totp-${clientId}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </Field>
        ) : null}
        {error ? (
          <p className="mt-2 text-[13px] text-rd">{error}</p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
