const moscowFmt = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Дата/время в Europe/Moscow: dd.MM.yyyy HH:mm */
export function formatDateTime(date: Date | string | number): string {
  return moscowFmt.format(new Date(date)).replace(",", "");
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ru-RU");
}
