import { describe, expect, it } from "vitest";
import { needsSetup2fa } from "@/server/auth/policy";

/** Логика обязательной 2FA для OWNER/ADMIN (REQUIRE_2FA по умолчанию true) */
describe("2FA gate", () => {
  it("OWNER/ADMIN без TOTP должны идти на setup-2fa", () => {
    const env = {};
    expect(needsSetup2fa({ role: "OWNER", totpEnabled: false }, env)).toBe(true);
    expect(needsSetup2fa({ role: "ADMIN", totpEnabled: false }, env)).toBe(true);
    expect(needsSetup2fa({ role: "OWNER", totpEnabled: true }, env)).toBe(false);
    expect(needsSetup2fa({ role: "PARTNER", totpEnabled: false }, env)).toBe(false);
  });
});
