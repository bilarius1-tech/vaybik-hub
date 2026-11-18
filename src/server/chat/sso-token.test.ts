import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  assertReturnUrlAllowed,
  buildSafeReturnUrl,
  issueSsoToken,
  verifySsoToken,
} from "./sso-token";

describe("sso token", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.CHAT_BASE_URL = "https://chat-test.vaybik.ru";
    process.env.HUB_CHAT_SSO_SECRET = "unit-test-sso-secret-not-real";
    process.env.APP_URL = "http://127.0.0.1:3000/admin";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("buildSafeReturnUrl на хосте APP_URL", () => {
    expect(buildSafeReturnUrl("/clients/abc")).toBe(
      "http://127.0.0.1:3000/admin/clients/abc",
    );
  });

  it("assertReturnUrlAllowed отклоняет чужой хост", () => {
    expect(
      assertReturnUrlAllowed("http://127.0.0.1:3000/admin/clients/x"),
    ).toBe(true);
    expect(assertReturnUrlAllowed("https://evil.example/x")).toBe(false);
  });

  it("выпуск и verify; токен не содержит plaintext secret", () => {
    const { token, jti, ssoUrl, exp } = issueSsoToken({
      mode: "impersonate",
      userId: "u1",
      email: "a@b.c",
      hubClientId: "c1",
      impersonatedBy: "u1",
      returnUrl: "http://127.0.0.1:3000/admin/clients/c1",
      nowSec: 1_700_000_000,
    });
    expect(jti).toMatch(/^[0-9a-f]{32}$/);
    expect(exp).toBe(1_700_000_060);
    expect(ssoUrl.startsWith("https://chat-test.vaybik.ru/sso?token=")).toBe(
      true,
    );
    expect(token.includes("unit-test-sso-secret")).toBe(false);

    const payload = verifySsoToken(
      token,
      "unit-test-sso-secret-not-real",
      1_700_000_000,
    );
    expect(payload?.jti).toBe(jti);
    expect(payload?.mode).toBe("impersonate");
    expect(payload?.hubClientId).toBe("c1");
    expect(payload?.impersonatedBy).toBe("u1");
  });

  it("просроченный токен не проходит verify", () => {
    const { token } = issueSsoToken({
      mode: "impersonate",
      userId: "u1",
      email: "a@b.c",
      hubClientId: "c1",
      impersonatedBy: "u1",
      returnUrl: "http://127.0.0.1:3000/admin/clients/c1",
      nowSec: 1_700_000_000,
    });
    expect(
      verifySsoToken(token, "unit-test-sso-secret-not-real", 1_700_000_061),
    ).toBeNull();
  });
});
