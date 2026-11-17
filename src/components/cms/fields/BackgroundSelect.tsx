"use client";

import { Field, Select } from "@/components/ui/Field";

export function BackgroundSelect({
  value,
  onChange,
}: {
  value: "default" | "alt" | string;
  onChange: (v: "default" | "alt") => void;
}) {
  return (
    <Field label="Фон">
      <Select
        value={value === "alt" ? "alt" : "default"}
        onChange={(e) => onChange(e.target.value as "default" | "alt")}
      >
        <option value="default">Обычный</option>
        <option value="alt">Альтернативный (alt)</option>
      </Select>
    </Field>
  );
}
