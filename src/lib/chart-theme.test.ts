import { describe, expect, it } from "vitest";
import { CHART_FALLBACK, withAlpha } from "@/lib/chart-theme";

describe("withAlpha", () => {
  it("hex → rgba", () => {
    expect(withAlpha("#ff8a1f", 0.14)).toBe("rgba(255, 138, 31, 0.14)");
    expect(withAlpha("#22c55e", 1)).toBe("rgba(34, 197, 94, 1)");
  });

  it("короткий hex", () => {
    expect(withAlpha("#abc", 0.5)).toBe("rgba(170, 187, 204, 0.5)");
  });

  it("rgb → rgba", () => {
    expect(withAlpha("rgb(9, 165, 195)", 0.2)).toBe("rgba(9, 165, 195, 0.2)");
  });
});

describe("CHART_FALLBACK", () => {
  it("акцент оранжевый хаба", () => {
    expect(CHART_FALLBACK.ac).toBe("#ff8a1f");
    expect(CHART_FALLBACK.gr).toBe("#22c55e");
  });
});
