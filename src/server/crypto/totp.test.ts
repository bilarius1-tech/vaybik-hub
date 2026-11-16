import { describe, expect, it } from "vitest";
import {
  createTotpSecret,
  currentTotp,
  generateBackupCodes,
  hashBackupCode,
  normalizeBackupCode,
  verifyTotp,
} from "./totp";

describe("totp", () => {
  it("генерирует и проверяет код", () => {
    const secret = createTotpSecret();
    const token = currentTotp(secret);
    expect(verifyTotp(secret, token)).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
  });

  it("нормализует резервные коды", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    const raw = codes[0]!;
    expect(hashBackupCode(raw)).toBe(
      hashBackupCode(normalizeBackupCode(raw).toLowerCase()),
    );
  });
});
