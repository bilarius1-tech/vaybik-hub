import { describe, expect, it } from "vitest";
import {
  decryptBuffer,
  encryptBuffer,
  encryptBufferV2,
  isBackupV2,
} from "./crypto";

const KEY = Buffer.from("0123456789abcdef0123456789abcdef"); // 32 bytes

describe("backup crypto", () => {
  it("v1: шифрует и расшифровывает", () => {
    const plain = Buffer.from("pg_dump-secret-payload-xyz", "utf8");
    const enc = encryptBuffer(plain, KEY);
    expect(enc.toString("utf8")).not.toContain("pg_dump-secret");
    expect(isBackupV2(enc)).toBe(false);
    expect(decryptBuffer(enc, KEY).equals(plain)).toBe(true);
  });

  it("v2: magic-формат и обратная совместимость decrypt", () => {
    const plain = Buffer.from("uploads-tar-gz-payload", "utf8");
    const enc = encryptBufferV2(plain, KEY);
    expect(isBackupV2(enc)).toBe(true);
    expect(enc.toString("utf8")).not.toContain("uploads-tar");
    expect(decryptBuffer(enc, KEY).equals(plain)).toBe(true);
  });
});
