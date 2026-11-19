import { createHash } from "node:crypto";
import argon2 from "argon2";

const MIN_PASSWORD_LENGTH = 12;
/** Приглашение клиента (этап 2) — ≥ 10 символов */
export const CLIENT_PASSWORD_MIN = 10;

export function assertPasswordPolicy(
  password: string,
  minLength = MIN_PASSWORD_LENGTH,
): void {
  if (password.length < minLength) {
    throw new Error(`Пароль должен быть не короче ${minLength} символов`);
  }
}

export async function hashPassword(
  password: string,
  minLength = MIN_PASSWORD_LENGTH,
): Promise<string> {
  assertPasswordPolicy(password, minLength);
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
