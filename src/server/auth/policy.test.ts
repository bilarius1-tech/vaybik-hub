import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS } from "@/server/auth/constants";
import {
  isRequire2fa,
  needsSetup2fa,
  rememberDays,
  sessionTtlMs,
} from "@/server/auth/policy";

describe("REQUIRE_2FA", () => {
  it("по умолчанию 2FA обязательна", () => {
    expect(isRequire2fa({})).toBe(true);
    expect(isRequire2fa({ REQUIRE_2FA: "true" })).toBe(true);
    expect(isRequire2fa({ REQUIRE_2FA: "false" })).toBe(false);
    expect(isRequire2fa({ REQUIRE_2FA: "0" })).toBe(false);
  });

  it("REQUIRE_2FA=false — OWNER без TOTP не отправляется на setup-2fa", () => {
    const env = { REQUIRE_2FA: "false" };
    expect(needsSetup2fa({ role: "OWNER", totpEnabled: false }, env)).toBe(false);
    expect(needsSetup2fa({ role: "ADMIN", totpEnabled: false }, env)).toBe(false);
  });
});

describe("Запомнить меня", () => {
  it("SESSION_REMEMBER_DAYS по умолчанию 30", () => {
    expect(rememberDays({})).toBe(30);
    expect(rememberDays({ SESSION_REMEMBER_DAYS: "7" })).toBe(7);
    expect(rememberDays({ SESSION_REMEMBER_DAYS: "abc" })).toBe(30);
    expect(rememberDays({ SESSION_REMEMBER_DAYS: "9999" })).toBe(365);
  });

  it("без галочки — 12 ч, с галочкой — N дней", () => {
    expect(sessionTtlMs(false, {})).toBe(SESSION_TTL_MS);
    expect(sessionTtlMs(true, { SESSION_REMEMBER_DAYS: "30" })).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
  });
});
