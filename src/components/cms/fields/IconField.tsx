"use client";

import { Field, Textarea } from "@/components/ui/Field";

export function IconField({
  label = "Иконка (SVG)",
  value,
  onChange,
}: {
  label?: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  const svg = value || "";
  return (
    <div className="space-y-2">
      <Field label={label}>
        <Textarea
          rows={3}
          value={svg}
          onChange={(e) => onChange(e.target.value)}
          placeholder="<svg …>"
          className="font-mono text-[12px]"
        />
      </Field>
      {svg.trim() ? (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-bd bg-bd/20 text-ac [&_svg]:h-6 [&_svg]:w-6"
          // безопасный превью: сервер санитайзит при сохранении
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
    </div>
  );
}
