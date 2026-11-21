import type { Period } from "@/server/services/period";

/** Шаг корзины для графика: день 5 мин, неделя 1 ч, месяц 6 ч. */
export function downsampleStepMs(period: Period): number {
  if (period === "day") return 5 * 60 * 1000;
  if (period === "week") return 60 * 60 * 1000;
  return 6 * 60 * 60 * 1000;
}

/**
 * Оставляет одну точку на корзину (последнюю), чтобы график покрывал весь период
 * без обрезания take:500.
 */
export function downsampleByTime<T extends { takenAt: Date }>(
  rows: T[],
  period: Period,
): T[] {
  if (rows.length === 0) return [];
  const step = downsampleStepMs(period);
  const out: T[] = [];
  let bucket = -1;
  let last: T | null = null;
  for (const row of rows) {
    const b = Math.floor(row.takenAt.getTime() / step);
    if (last && b !== bucket) {
      out.push(last);
    }
    bucket = b;
    last = row;
  }
  if (last) out.push(last);
  return out;
}

/**
 * Скорость сети (бит/с) между соседними сэмплами накопительных байт.
 * Отрицательный скачок (сброс счётчика) → 0.
 */
export function netRatesBps(
  samples: { t: Date; rx: bigint; tx: bigint }[],
): { t: Date; rxBps: number; txBps: number }[] {
  const out: { t: Date; rxBps: number; txBps: number }[] = [];
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    const dtSec = (cur.t.getTime() - prev.t.getTime()) / 1000;
    if (dtSec <= 0) {
      out.push({ t: cur.t, rxBps: 0, txBps: 0 });
      continue;
    }
    const dRx = cur.rx >= prev.rx ? cur.rx - prev.rx : BigInt(0);
    const dTx = cur.tx >= prev.tx ? cur.tx - prev.tx : BigInt(0);
    out.push({
      t: cur.t,
      rxBps: (Number(dRx) * 8) / dtSec,
      txBps: (Number(dTx) * 8) / dtSec,
    });
  }
  return out;
}
