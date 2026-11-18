"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import {
  addMonthsYmd,
  extendBaseYmd,
  todayMskYmd,
} from "@/lib/period-ymd";
import { useState } from "react";

type Props = {
  clientServiceId: string;
  activeFrom: string | null;
  activeUntil: string | null;
  paymentNote: string | null;
  disabled?: boolean;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function ServicePeriodControls({
  clientServiceId,
  activeFrom,
  activeUntil,
  paymentNote,
  disabled,
  onSaved,
  onError,
}: Props) {
  const [from, setFrom] = useState(activeFrom ?? "");
  const [until, setUntil] = useState(activeUntil ?? "");
  const [note, setNote] = useState(paymentNote ?? "");
  const [busy, setBusy] = useState(false);

  function bump(months: number) {
    const base = extendBaseYmd(until || null, todayMskYmd());
    setUntil(addMonthsYmd(base, months));
  }

  async function save() {
    setBusy(true);
    const res = await api(`/api/clients/services/${clientServiceId}`, {
      method: "PATCH",
      body: JSON.stringify({
        activeFrom: from.trim() ? from.trim() : null,
        activeUntil: until.trim() ? until.trim() : null,
        paymentNote: note.trim() ? note.trim() : null,
      }),
    });
    setBusy(false);
    if (res.error) {
      onError(res.error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="mt-3 space-y-2 rounded-[10px] border border-bd/80 bg-bg/40 p-3">
      <p className="text-[12.5px] font-bold text-tx">Срок работы (MSK)</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Начало" htmlFor={`from-${clientServiceId}`}>
          <Input
            id={`from-${clientServiceId}`}
            type="date"
            value={from}
            disabled={busy || disabled}
            onChange={(e) => setFrom(e.target.value)}
            className="max-w-[160px]"
          />
        </Field>
        <Field label="Конец" htmlFor={`until-${clientServiceId}`}>
          <Input
            id={`until-${clientServiceId}`}
            type="date"
            value={until}
            disabled={busy || disabled}
            onChange={(e) => setUntil(e.target.value)}
            className="max-w-[160px]"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 12].map((m) => (
          <Button
            key={m}
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || disabled}
            onClick={() => bump(m)}
          >
            +{m} мес
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          disabled={busy || disabled}
          onClick={() => void save()}
        >
          {busy ? "…" : "Продлить"}
        </Button>
      </div>
      <Field label="Комментарий к оплате" htmlFor={`pay-${clientServiceId}`}>
        <Input
          id={`pay-${clientServiceId}`}
          value={note}
          disabled={busy || disabled}
          onChange={(e) => setNote(e.target.value)}
          placeholder="сумма / условия"
        />
      </Field>
    </div>
  );
}
