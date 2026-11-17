import { describe, expect, it } from "vitest";
import { fixMissingSvgViewBox, renderMascotPicture } from "./leadweb-icons";

describe("fixMissingSvgViewBox", () => {
  it("добавляет viewBox к svg без него", () => {
    const out = fixMissingSvgViewBox(
      '<svg class="ic" width="24" height="24" fill="none"><path d="M1"/></svg>',
    );
    expect(out).toContain('viewBox="0 0 24 24"');
  });

  it("не дублирует существующий viewBox", () => {
    const src =
      '<svg width="24" height="24" viewBox="0 0 10 10"><path d="M1"/></svg>';
    expect(fixMissingSvgViewBox(src)).toBe(src);
  });
});

describe("renderMascotPicture", () => {
  it("строит picture/srcset", () => {
    const html = renderMascotPicture("privet", { fetchPriority: "high" });
    expect(html).toContain("<picture>");
    expect(html).toContain("vaybik-privet-400.webp");
    expect(html).toContain('fetchpriority="high"');
    expect(html).toContain("машет лапой");
  });
});
