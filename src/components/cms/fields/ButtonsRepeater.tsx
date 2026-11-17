"use client";

import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

export type ButtonItem = {
  label: string;
  href: string;
  style?: "primary" | "secondary";
};

export function ButtonsRepeater({
  value,
  onChange,
}: {
  value: ButtonItem[];
  onChange: (v: ButtonItem[]) => void;
}) {
  function update(i: number, patch: Partial<ButtonItem>) {
    onChange(value.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-mu">Кнопки</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([...value, { label: "Кнопка", href: "/", style: "primary" }])
          }
        >
          + кнопка
        </Button>
      </div>
      {value.map((b, i) => (
        <div key={i} className="rounded-xl border border-bd p-2 space-y-1">
          <Field label="Текст">
            <Input
              value={b.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
          </Field>
          <Field label="Ссылка">
            <Input
              value={b.href}
              onChange={(e) => update(i, { href: e.target.value })}
            />
          </Field>
          <Field label="Стиль">
            <Select
              value={b.style || "primary"}
              onChange={(e) =>
                update(i, {
                  style: e.target.value as "primary" | "secondary",
                })
              }
            >
              <option value="primary">Основная</option>
              <option value="secondary">Вторичная</option>
            </Select>
          </Field>
          <Button
            size="sm"
            variant="danger"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            Удалить
          </Button>
        </div>
      ))}
    </div>
  );
}
