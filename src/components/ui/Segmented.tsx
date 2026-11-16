"use client";

import { cn } from "@/lib/cn";

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-lg border border-bd bg-card p-[3px]",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-sm px-4 py-1.5 text-[13px] font-semibold transition-all duration-150",
              active
                ? "bg-ac text-ac-contrast shadow-[0_4px_14px_color-mix(in_srgb,var(--ac)_33%,transparent)]"
                : "text-mu hover:text-tx",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
