import { describe, expect, it } from "vitest";
import {
  addMonthsYmd,
  daysRemaining,
  dateToYmd,
  extendBaseYmd,
  isYmd,
  periodTone,
  todayMskYmd,
  ymdToDate,
} from "./period-ymd";

describe("period-ymd", () => {
  it("валидирует YYYY-MM-DD", () => {
    expect(isYmd("2026-11-18")).toBe(true);
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("26-11-18")).toBe(false);
  });

  it("roundtrip Date ↔ ymd", () => {
    const d = ymdToDate("2026-03-31");
    expect(dateToYmd(d)).toBe("2026-03-31");
  });

  it("addMonthsYmd от конца", () => {
    expect(addMonthsYmd("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsYmd("2026-11-18", 1)).toBe("2026-12-18");
    expect(addMonthsYmd("2026-11-18", 12)).toBe("2027-11-18");
  });

  it("daysRemaining и tone", () => {
    expect(daysRemaining("2026-11-25", "2026-11-18")).toBe(7);
    expect(periodTone("2026-11-25", "2026-11-18")).toBe("warn");
    expect(periodTone("2026-11-18", "2026-11-18")).toBe("warn");
    expect(periodTone("2026-11-17", "2026-11-18")).toBe("expired");
    expect(periodTone("2026-12-31", "2026-11-18")).toBe("ok");
    expect(periodTone(null)).toBe("none");
  });

  it("extendBaseYmd", () => {
    expect(extendBaseYmd("2026-12-01", "2026-11-18")).toBe("2026-12-01");
    expect(extendBaseYmd(null, "2026-11-18")).toBe("2026-11-18");
  });

  it("todayMskYmd формат", () => {
    expect(todayMskYmd(new Date("2026-11-18T10:00:00+03:00"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
