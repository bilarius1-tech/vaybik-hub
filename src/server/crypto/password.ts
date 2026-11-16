import { createHash } from "node:crypto";
import argon2 from "argon2";

const MIN_PASSWORD_LENGTH = 12;

export function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Хеш для токенов сессии/инвайтов/резервных кодов (lookup по SHA-256) */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
