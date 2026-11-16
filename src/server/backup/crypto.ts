import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

export function backupKeyFromEnv(envKey = "BACKUP_ENCRYPTION_KEY"): Buffer {
  const raw = process.env[envKey];
  if (!raw) throw new Error(`${envKey} не задан`);
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`${envKey} должен быть 32 байта в base64`);
  }
  return buf;
}

/** ciphertext = iv(12) || tag(16) || data */
export function encryptBuffer(plaintext: Buffer, key = backupKeyFromEnv()): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]);
}

export function decryptBuffer(blob: Buffer, key = backupKeyFromEnv()): Buffer {
  if (blob.length < IV_LEN + 16) throw new Error("Слишком короткий бэкап");
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + 16);
  const data = blob.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
