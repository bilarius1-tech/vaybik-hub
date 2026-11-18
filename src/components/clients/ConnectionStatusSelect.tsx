"use client";

import { Select } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import {
  SERVICE_STATUS_LABEL,
  type ClientServiceStatusCode,
} from "@/lib/client-status-labels";
import { useState } from "react";

type Props = {
  clientServiceId: string;
  status: ClientServiceStatusCode;
  disabled?: boolean;
  onToast?: (tone: "ok" | "err", text: string) => void;
  onSaved?: () => void;
};

/**
 * Статус подключения: автосохранение при выборе (PATCH + sync в чат).
 */
export function ConnectionStatusSelect({
  clientServiceId,
  status,
  disabled,
  onToast,
  onSaved,
}: Props) {
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function onChange(next: ClientServiceStatusCode) {
    const prev = value;
    setValue(next);
    setBusy(true);
    const res = await api(`/api/clients/services/${clientServiceId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    if (res.error) {
      setValue(prev);
      onToast?.("err", res.error.message || "Ошибка");
      return;
    }
    onToast?.("ok", "Сохранено");
    onSaved?.();
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-mu">Статус подключения:</span>
        <Select
          className="max-w-[180px]"
          value={value}
          disabled={busy || disabled}
          onChange={(e) =>
            void onChange(e.target.value as ClientServiceStatusCode)
          }
        >
          {(Object.keys(SERVICE_STATUS_LABEL) as ClientServiceStatusCode[]).map(
            (code) => (
              <option key={code} value={code}>
                {SERVICE_STATUS_LABEL[code]}
              </option>
            ),
          )}
        </Select>
      </div>
      <p className="text-[11.5px] text-mu">
        Только этот сервис: Настройка / Активен / На паузе / Отключён.
        Сохраняется сразу при выборе.
      </p>
    </div>
  );
}
