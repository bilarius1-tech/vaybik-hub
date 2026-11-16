import { cn } from "@/lib/cn";

type Status = "up" | "down" | "degraded" | "unknown";

type Props = {
  status?: Status;
  className?: string;
  pulse?: boolean;
  label?: string;
};

const colors: Record<Status, string> = {
  up: "bg-gr",
  down: "bg-rd",
  degraded: "bg-yl",
  unknown: "bg-mu",
};

export function StatusDot({
  status = "up",
  className,
  pulse = status === "up",
  label,
}: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          colors[status],
          pulse && status === "up" && "animate-live",
        )}
        aria-hidden
      />
      {label ? <span className="text-[12.5px] text-mu">{label}</span> : null}
    </span>
  );
}
