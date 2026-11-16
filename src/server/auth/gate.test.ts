import { describe, expect, it } from "vitest";

/** Логика обязательной 2FA для OWNER/ADMIN (без next/navigation) */
function needsSetup2fa(role: string, totpEnabled: boolean): boolean {
  return (role === "OWNER" || role === "ADMIN") && !totpEnabled;
}

describe("2FA gate", () => {
  it("OWNER/ADMIN без TOTP должны идти на setup-2fa", () => {
    expect(needsSetup2fa("OWNER", false)).toBe(true);
    expect(needsSetup2fa("ADMIN", false)).toBe(true);
    expect(needsSetup2fa("OWNER", true)).toBe(false);
    expect(needsSetup2fa("PARTNER", false)).toBe(false);
  });
});
