import { describe, expect, it } from "vitest";
import { signHubBody, verifyHubSignature } from "./signature";

describe("hub chat signature", () => {
  const secret = "test-api-secret-not-real";
  const body = JSON.stringify({
    hubClientId: "cl_1",
    name: "Тест",
    status: "active",
  });

  it("подпись проходит verify", () => {
    const t = 1_700_000_000;
    const header = signHubBody(secret, body, t);
    expect(verifyHubSignature(secret, body, header, t)).toBe(true);
  });

  it("отклоняет чужой секрет", () => {
    const header = signHubBody(secret, body, 1_700_000_000);
    expect(
      verifyHubSignature("other", body, header, 1_700_000_000),
    ).toBe(false);
  });

  it("отклоняет |now−t| > 300", () => {
    const t = 1_700_000_000;
    const header = signHubBody(secret, body, t);
    expect(verifyHubSignature(secret, body, header, t + 301)).toBe(false);
  });

  it("отклоняет подмену тела", () => {
    const t = 1_700_000_000;
    const header = signHubBody(secret, body, t);
    expect(
      verifyHubSignature(secret, body.replace("Тест", "X"), header, t),
    ).toBe(false);
  });
});
