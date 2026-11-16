import { describe, expect, it } from "vitest";
import { decryptBuffer, encryptBuffer } from "./crypto";

const KEY = Buffer.from("0123456789abcdef0123456789abcdef"); // 32 bytes

describe("backup crypto", () => {
  it("шифрует и расшифровывает без утечки plaintext", () => {
    const plain = Buffer.from("pg_dump-secret-payload-xyz", "utf8");
    const enc = encryptBuffer(plain, KEY);
    expect(enc.toString("utf8")).not.toContain("pg_dump-secret");
    expect(decryptBuffer(enc, KEY).equals(plain)).toBe(true);
  });
});
