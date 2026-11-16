import { cn } from "@/lib/cn";

type Tone = "ok" | "warn" | "bad";

type Props = {
  label: string;
  value: string;
  delta?: string;
  tone?: Tone;
  className?: string;
};

const bar: Record<Tone, string> = {
  ok: "from-ac",
  warn: "from-yl",
  bad: "from-rd",
};

export function Kpi({ label, value, delta, tone = "ok", className }: Props) {
  const deltaPositive = delta?.startsWith("+");
  const deltaNegative = delta?.startsWith("−") || delta?.startsWith("-");

  return (
    <div
      className={cn(
        "rounded-2xl border border-bd bg-gradient-to-b from-card2 to-card p-4 shadow-card",
        className,
      )}
    >
      <div className="text-[12.5px] font-semibold text-mu">{label}</div>
      <div className="mt-1 text-[28px] font-extrabold leading-none text-tx">{value}</div>
      {delta ? (
        <div
          className={cn(
            "mt-1.5 text-[12px] font-semibold",
            deltaPositive && "text-gr",
            deltaNegative && "text-rd",
            !deltaPositive && !deltaNegative && "text-mu",
          )}
        >
          {delta}
        </div>
      ) : null}
      <div
        className={cn(
          "mt-3 h-[3px] rounded-full bg-gradient-to-r to-transparent",
          bar[tone],
        )}
        style={{ width: "70%" }}
      />
    </div>
  );
}
