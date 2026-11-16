import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function Insight({ children, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-md border border-insbd bg-insbg px-3 py-2.5 text-[12.5px] text-mu [&_strong]:font-bold [&_strong]:text-tx",
        className,
      )}
    >
      {children}
    </div>
  );
}
