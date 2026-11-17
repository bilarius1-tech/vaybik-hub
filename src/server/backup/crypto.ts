import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";
import { createWriteStream } from "node:fs";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { open } from "node:fs/promises";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
/** Маркер потокового формата v2: "VBK2" */
export const BACKUP_V2_MAGIC = Buffer.from("VBK2");

export function backupKeyFromEnv(envKey = "BACKUP_ENCRYPTION_KEY"): Buffer {
  const raw = process.env[envKey];
  if (!raw) throw new Error(`${envKey} не задан`);
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`${envKey} должен быть 32 байта в base64`);
  }
  return buf;
}

/** v1 ciphertext = iv(12) || tag(16) || data */
export function encryptBuffer(plaintext: Buffer, key = backupKeyFromEnv()): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]);
}

/** v2: magic(4) || iv(12) || ciphertext || tag(16) в конце */
export function encryptBufferV2(plaintext: Buffer, key = backupKeyFromEnv()): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv) as CipherGCM;
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([BACKUP_V2_MAGIC, iv, data, tag]);
}

export function isBackupV2(blob: Buffer): boolean {
  return (
    blob.length >= BACKUP_V2_MAGIC.length + IV_LEN + 16 &&
    blob.subarray(0, 4).equals(BACKUP_V2_MAGIC)
  );
}

export function decryptBuffer(blob: Buffer, key = backupKeyFromEnv()): Buffer {
  if (isBackupV2(blob)) {
    const iv = blob.subarray(4, 4 + IV_LEN);
    const tag = blob.subarray(blob.length - 16);
    const data = blob.subarray(4 + IV_LEN, blob.length - 16);
    const decipher = createDecipheriv(ALGO, key, iv) as DecipherGCM;
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
  if (blob.length < IV_LEN + 16) throw new Error("Слишком короткий бэкап");
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + 16);
  const data = blob.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Потоковое шифрование v2: input stream → file.
 * Формат: magic || iv || ciphertext || tag
 */
export async function encryptStreamToFile(
  input: Readable,
  outPath: string,
  key = backupKeyFromEnv(),
): Promise<void> {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv) as CipherGCM;
  const out = createWriteStream(outPath);
  out.write(BACKUP_V2_MAGIC);
  out.write(iv);

  await pipeline(input, cipher, out);

  const tag = cipher.getAuthTag();
  const fh = await open(outPath, "a");
  try {
    await fh.write(tag);
  } finally {
    await fh.close();
  }
}
