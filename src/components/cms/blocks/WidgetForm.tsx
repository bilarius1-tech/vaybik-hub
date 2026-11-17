"use client";

import { Field, Select, Textarea } from "@/components/ui/Field";

type WidgetData = {
  key?: "studio" | "calcMini" | "calcFull";
  htmlSnapshot?: string;
  showMore?: boolean;
};

export function WidgetForm({
  data,
  onChange,
}: {
  data: WidgetData;
  onChange: (data: WidgetData) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Виджет">
        <Select
          value={data.key || "studio"}
          onChange={(e) =>
            onChange({
              ...data,
              key: e.target.value as WidgetData["key"],
            })
          }
        >
          <option value="studio">studio</option>
          <option value="calcMini">calcMini</option>
          <option value="calcFull">calcFull</option>
        </Select>
      </Field>
      {data.key === "calcMini" ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.showMore !== false}
            onChange={(e) =>
              onChange({ ...data, showMore: e.target.checked })
            }
          />
          Ссылка «Подробный калькулятор» (calc-more)
        </label>
      ) : null}
      <Field label="HTML-снимок (запасной, публичный рендер берёт шаблон)">
        <Textarea
          rows={8}
          value={data.htmlSnapshot || ""}
          onChange={(e) => onChange({ ...data, htmlSnapshot: e.target.value })}
          className="font-mono text-[12px]"
        />
      </Field>
    </div>
  );
}
