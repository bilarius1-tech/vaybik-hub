/** Календарные даты срока (день без времени, UI — MSK). */

const MSK = "Europe/Moscow";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: string): boolean {
  if (!YMD_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Сегодняшняя календарная дата в MSK как YYYY-MM-DD. */
export function todayMskYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MSK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Prisma @db.Date → YYYY-MM-DD (UTC-календарь записи). */
export function dateToYmd(d: Date | null | undefined): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → Date для Prisma @db.Date (UTC midnight). */
export function ymdToDate(ymd: string): Date {
  if (!isYmd(ymd)) throw new Error(`Некорректная дата: ${ymd}`);
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Добавить N месяцев к YYYY-MM-DD (день обрезается до длины целевого месяца). */
export function addMonthsYmd(ymd: string, months: number): string {
  if (!isYmd(ymd)) throw new Error(`Некорректная дата: ${ymd}`);
  const [y, m, d] = ymd.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const lastDay = new Date(Date.UTC(y, targetMonthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return dateToYmd(new Date(Date.UTC(y, targetMonthIndex, day)))!;
}

/** Сколько полных дней осталось до until. */
export function daysRemaining(untilYmd: string, todayYmd = todayMskYmd()): number {
  if (!isYmd(untilYmd) || !isYmd(todayYmd)) return 0;
  const until = ymdToDate(untilYmd).getTime();
  const today = ymdToDate(todayYmd).getTime();
  return Math.round((until - today) / 86_400_000);
}

export type PeriodTone = "ok" | "warn" | "expired" | "none";

export function periodTone(
  untilYmd: string | null,
  todayYmd = todayMskYmd(),
): PeriodTone {
  if (!untilYmd) return "none";
  const left = daysRemaining(untilYmd, todayYmd);
  if (left < 0) return "expired";
  if (left <= 7) return "warn";
  return "ok";
}

/** База для «+N мес»: текущий конец, иначе сегодня. */
export function extendBaseYmd(
  activeUntil: string | null,
  todayYmd = todayMskYmd(),
): string {
  return activeUntil && isYmd(activeUntil) ? activeUntil : todayYmd;
}

/** YYYY-MM-DD → ДД.ММ.ГГГГ */
export function formatYmdRu(ymd: string): string {
  if (!isYmd(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Текст колонки «Работает до».
 * «до 18.01.2027 · осталось 61 дн.» / жёлтый ≤7 / «истёк N дн. назад» / «без срока».
 */
export function worksUntilLabel(
  untilYmd: string | null,
  todayYmd = todayMskYmd(),
): { text: string; tone: PeriodTone } {
  if (!untilYmd || !isYmd(untilYmd)) {
    return { text: "без срока", tone: "none" };
  }
  const left = daysRemaining(untilYmd, todayYmd);
  const dateRu = formatYmdRu(untilYmd);
  if (left < 0) {
    return {
      text: `до ${dateRu} · истёк ${Math.abs(left)} дн. назад`,
      tone: "expired",
    };
  }
  const tone: PeriodTone = left <= 7 ? "warn" : "ok";
  return { text: `до ${dateRu} · осталось ${left} дн.`, tone };
}

/** ISO / Date / YYYY-MM-DD → YYYY-MM-DD или null */
export function coerceYmd(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return dateToYmd(value);
  if (typeof value === "string") {
    if (isYmd(value)) return value;
    const head = value.slice(0, 10);
    if (isYmd(head)) return head;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return dateToYmd(d);
  }
  return null;
}
