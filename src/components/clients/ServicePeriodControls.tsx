"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api } from "@/lib/api-client";
import {
  addMonthsYmd,
  coerceYmd,
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
  // Родитель задаёт key по датам — при refresh с сервера компонент монтируется заново.
  const savedFrom = coerceYmd(activeFrom) ?? "";
  const savedUntil = coerceYmd(activeUntil) ?? "";
  const savedNote = paymentNote ?? "";

  const [from, setFrom] = useState(savedFrom);
  const [until, setUntil] = useState(savedUntil);
  const [note, setNote] = useState(savedNote);
  const [busy, setBusy] = useState(false);

  const dirty =
    from !== savedFrom || until !== savedUntil || note !== savedNote;

  function bump(months: number) {
    const base = extendBaseYmd(until || null, todayMskYmd());
    setUntil(addMonthsYmd(base, months));
  }

  async function savePeriod(next?: {
    from?: string;
    until?: string;
    note?: string;
  }) {
    const f = next?.from ?? from;
    const u = next?.until ?? until;
    const n = next?.note ?? note;
    setBusy(true);
    const res = await api(`/api/clients/services/${clientServiceId}`, {
      method: "PATCH",
      body: JSON.stringify({
        activeFrom: f.trim() ? f.trim() : null,
        activeUntil: u.trim() ? u.trim() : null,
        paymentNote: n.trim() ? n.trim() : null,
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
    <form
      className="mt-3 space-y-2 rounded-[10px] border border-bd/80 bg-bg/40 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void savePeriod();
      }}
    >
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || disabled || !dirty}>
          {busy ? "…" : "Сохранить срок"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || disabled}
          title="Прибавить 1 месяц к концу и сразу записать"
          onClick={() => {
            const base = extendBaseYmd(until || null, todayMskYmd());
            const nextUntil = addMonthsYmd(base, 1);
            setUntil(nextUntil);
            void savePeriod({ until: nextUntil });
          }}
        >
          Продлить +1 мес
        </Button>
      </div>
      <p className="text-[11.5px] text-mu">
        Срок пишется только отсюда (и уходит в чат). Кнопка «Сохранить» в
        карточке клиента срок не трогает.
      </p>
    </form>
  );
}
