import { describe, expect, it } from "vitest";
import {
  assertPasswordPolicy,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from "./password";

describe("password", () => {
  it("отклоняет короткий пароль", () => {
    expect(() => assertPasswordPolicy("short")).toThrow(/12/);
  });

  it("хеширует argon2id и проверяет", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct-horse-battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong-password!!")).toBe(false);
  });

  it("sha256 стабилен", () => {
    expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
    expect(sha256Hex("abc")).not.toBe(sha256Hex("abcd"));
  });
});
