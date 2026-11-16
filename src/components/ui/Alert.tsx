import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "warn" | "bad";

type Props = {
  title: string;
  tone?: Tone;
  children: ReactNode;
  className?: string;
};

export function Alert({ title, tone = "warn", children, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-bd bg-gradient-to-b from-card2 to-card p-4 shadow-card",
        tone === "bad" ? "border-l-[3px] border-l-rd" : "border-l-[3px] border-l-yl",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[13.5px] font-extrabold text-tx">
        <span aria-hidden>{tone === "bad" ? "⚠" : "⚡"}</span>
        {title}
      </div>
      <div className="mt-1.5 text-[12.5px] text-mu">{children}</div>
    </div>
  );
}
