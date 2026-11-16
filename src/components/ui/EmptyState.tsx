import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon = "◇",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-bd bg-card/40 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-3 text-3xl text-mu opacity-70" aria-hidden>
        {icon}
      </div>
      <div className="text-[15px] font-extrabold text-tx">{title}</div>
      {description ? (
        <p className="mt-1.5 max-w-md text-[13px] text-mu">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
