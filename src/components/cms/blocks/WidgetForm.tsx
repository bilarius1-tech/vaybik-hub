"use client";

import { Field, Select, Textarea } from "@/components/ui/Field";

type WidgetData = {
  key?: "studio" | "calcMini" | "calcFull";
  htmlSnapshot?: string;
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
      <Field label="HTML-снимок">
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
