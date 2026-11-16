import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("склеивает правдивые классы и пропускает пустые", () => {
    expect(cn("a", false && "b", undefined, "c", null)).toBe("a c");
  });
});
