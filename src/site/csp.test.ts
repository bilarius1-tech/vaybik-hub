import { describe, expect, it } from "vitest";
import { SITE_CSP_REPORT_ONLY } from "./csp";

describe("SITE_CSP_REPORT_ONLY", () => {
  it("разрешает chat.vaybik.ru в script-src и frame-src", () => {
    expect(SITE_CSP_REPORT_ONLY).toMatch(
      /script-src[^;]*https:\/\/chat\.vaybik\.ru/,
    );
    expect(SITE_CSP_REPORT_ONLY).toMatch(
      /frame-src[^;]*https:\/\/chat\.vaybik\.ru/,
    );
    expect(SITE_CSP_REPORT_ONLY).toContain("https://mc.yandex.ru");
  });
});
