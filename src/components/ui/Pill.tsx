import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "green" | "yellow" | "red" | "accent" | "demo";

type Props = {
  tone?: Tone;
  children: ReactNode;
  className?: string;
};

const tones: Record<Tone, string> = {
  green: "bg-[color-mix(in_srgb,var(--gr)_12%,transparent)] text-gr border-[color-mix(in_srgb,var(--gr)_33%,transparent)]",
  yellow:
    "bg-[color-mix(in_srgb,var(--yl)_12%,transparent)] text-yl border-[color-mix(in_srgb,var(--yl)_33%,transparent)]",
  red: "bg-[color-mix(in_srgb,var(--rd)_12%,transparent)] text-rd border-[color-mix(in_srgb,var(--rd)_33%,transparent)]",
  accent:
    "bg-[color-mix(in_srgb,var(--ac)_12%,transparent)] text-ac border-[color-mix(in_srgb,var(--ac)_33%,transparent)]",
  demo: "bg-[color-mix(in_srgb,var(--yl)_12%,transparent)] text-yl border-[color-mix(in_srgb,var(--yl)_33%,transparent)]",
};

export function Pill({ tone = "accent", children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-[9px] py-[3px] text-[11.5px] font-bold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
