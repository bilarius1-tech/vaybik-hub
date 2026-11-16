import { describe, expect, it } from "vitest";
import { generatePassword } from "./password";

describe("generatePassword", () => {
  it("длина ≥ 12 и содержит классы символов", () => {
    const p = generatePassword(20);
    expect(p.length).toBe(20);
    expect(/[a-z]/.test(p)).toBe(true);
    expect(/[A-Z]/.test(p)).toBe(true);
    expect(/[0-9]/.test(p)).toBe(true);
  });
});
