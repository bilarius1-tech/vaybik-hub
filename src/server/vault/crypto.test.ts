import { describe, expect, it } from "vitest";
import {
  assertNoPlaintextLeak,
  openVaultPayload,
  sealVaultPayload,
} from "./crypto";

const MASTER = Buffer.from("0123456789abcdef0123456789abcdef"); // 32 bytes

describe("vault envelope", () => {
  it("шифрует и расшифровывает payload", () => {
    const sealed = sealVaultPayload({ password: "s3cret-value!!" }, MASTER);
    const opened = openVaultPayload(sealed.data, sealed.dek, MASTER);
    expect(opened.password).toBe("s3cret-value!!");
    expect(sealed.data.ciphertext.toString("utf8")).not.toContain("s3cret");
  });

  it("в ciphertext нет открытого текста", () => {
    const sealed = sealVaultPayload({ token: "telegram-bot-token-xyz" }, MASTER);
    assertNoPlaintextLeak(
      {
        dataEnc: sealed.data.ciphertext,
        dekEnc: sealed.dek.ciphertext,
      },
      ["telegram-bot-token-xyz"],
    );
  });
});
