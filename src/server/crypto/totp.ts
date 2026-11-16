import { generateSecret, generateSync, generateURI, verifySync } from "otplib";
import { randomBytes } from "node:crypto";
import { sha256Hex } from "@/server/crypto/password";

const ISSUER = "Вайбик";

export function createTotpSecret(): string {
  return generateSecret();
}

export function buildTotpUri(email: string, secret: string): string {
  return generateURI({
    issuer: ISSUER,
    label: email,
    secret,
  });
}

export function verifyTotp(secret: string, token: string): boolean {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const result = verifySync({ secret, token: clean });
  return result.valid === true;
}

export function currentTotp(secret: string): string {
  return generateSync({ secret });
}

/** 10 одноразовых резервных кодов вида XXXX-XXXX */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return sha256Hex(normalizeBackupCode(code));
}

export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}
