import { describe, expect, it } from "vitest";
import {
  downsampleByTime,
  downsampleStepMs,
  netRatesBps,
} from "@/server/services/downsample";

describe("downsampleByTime", () => {
  it("неделя: шаг 1 час, точки покрывают весь диапазон", () => {
    expect(downsampleStepMs("week")).toBe(60 * 60 * 1000);
    const start = Date.UTC(2026, 10, 14, 0, 0, 0);
    const rows: { takenAt: Date; i: number }[] = [];
    // 7 дней × 24 × 12 = 2016 минутных точек (каждые 5 мин для скорости теста)
    for (let m = 0; m < 7 * 24 * 12; m++) {
      rows.push({
        takenAt: new Date(start + m * 5 * 60 * 1000),
        i: m,
      });
    }
    const thin = downsampleByTime(rows, "week");
    expect(thin.length).toBeGreaterThanOrEqual(7 * 24 - 1);
    expect(thin.length).toBeLessThanOrEqual(7 * 24 + 1);
    // в корзине остаётся последняя точка часа
    expect(thin[thin.length - 1]!.takenAt.getTime()).toBe(
      rows[rows.length - 1]!.takenAt.getTime(),
    );
    // без take:500 — покрываем дальше 500 минут
    const spanMin =
      (thin[thin.length - 1]!.takenAt.getTime() - thin[0]!.takenAt.getTime()) /
      60_000;
    expect(spanMin).toBeGreaterThan(500);
  });

  it("день: шаг 5 мин", () => {
    const start = Date.UTC(2026, 10, 21, 0, 0, 0);
    const rows = Array.from({ length: 24 * 60 }, (_, m) => ({
      takenAt: new Date(start + m * 60_000),
    }));
    const thin = downsampleByTime(rows, "day");
    expect(thin.length).toBeLessThanOrEqual(24 * 12 + 2);
    expect(thin.length).toBeGreaterThan(24 * 10);
  });
});

describe("netRatesBps", () => {
  it("считает бит/с и обнуляет откат счётчика", () => {
    const t0 = new Date("2026-11-21T12:00:00Z");
    const t1 = new Date("2026-11-21T12:01:00Z");
    const t2 = new Date("2026-11-21T12:02:00Z");
    const rates = netRatesBps([
      { t: t0, rx: BigInt(0), tx: BigInt(0) },
      { t: t1, rx: BigInt(1_000_000), tx: BigInt(500_000) },
      { t: t2, rx: BigInt(100), tx: BigInt(100) }, // сброс
    ]);
    expect(rates).toHaveLength(2);
    expect(rates[0]!.rxBps).toBeCloseTo((1_000_000 * 8) / 60, 0);
    expect(rates[0]!.txBps).toBeCloseTo((500_000 * 8) / 60, 0);
    expect(rates[1]!.rxBps).toBe(0);
    expect(rates[1]!.txBps).toBe(0);
  });
});
