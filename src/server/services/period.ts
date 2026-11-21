export type Period = "day" | "week" | "month";

export function periodSince(period: Period): Date {
  const now = Date.now();
  const ms =
    period === "day"
      ? 24 * 60 * 60 * 1000
      : period === "week"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return new Date(now - ms);
}
