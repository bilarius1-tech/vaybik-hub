"use client";

import { Field, Textarea } from "@/components/ui/Field";

export function RawHtmlForm({
  data,
  onChange,
}: {
  data: { html?: string };
  onChange: (data: { html?: string }) => void;
}) {
  return (
    <Field label="HTML">
      <Textarea
        rows={14}
        value={data.html || ""}
        onChange={(e) => onChange({ html: e.target.value })}
        className="font-mono text-[12px]"
      />
    </Field>
  );
}
