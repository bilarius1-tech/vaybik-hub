import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const DEK_LEN = 32;

export type EncryptedBlob = {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
};

function masterKeyFromEnv(envKey = "VAULT_MASTER_KEY"): Buffer {
  const raw = process.env[envKey];
  if (!raw) throw new Error(`${envKey} не задан`);
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`${envKey} должен быть 32 байта в base64`);
  }
  return buf;
}

export function currentKeyVersion(): number {
  const v = Number(process.env.VAULT_KEY_VERSION || "1");
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function encryptWithKey(key: Buffer, plaintext: Buffer): EncryptedBlob {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

function decryptWithKey(key: Buffer, blob: EncryptedBlob): Buffer {
  const decipher = createDecipheriv(ALGO, key, blob.iv);
  decipher.setAuthTag(blob.tag);
  return Buffer.concat([decipher.update(blob.ciphertext), decipher.final()]);
}

/** Envelope: новый DEK → шифрует payload; DEK шифруется мастер-ключом */
export function sealVaultPayload(
  payload: Record<string, unknown>,
  masterKey = masterKeyFromEnv(),
): {
  data: EncryptedBlob;
  dek: EncryptedBlob;
  keyVersion: number;
} {
  const dek = randomBytes(DEK_LEN);
  const data = encryptWithKey(dek, Buffer.from(JSON.stringify(payload), "utf8"));
  const dekEnc = encryptWithKey(masterKey, dek);
  return { data, dek: dekEnc, keyVersion: currentKeyVersion() };
}

export function openVaultPayload(
  data: EncryptedBlob,
  dek: EncryptedBlob,
  masterKey = masterKeyFromEnv(),
): Record<string, unknown> {
  const plainDek = decryptWithKey(masterKey, dek);
  const json = decryptWithKey(plainDek, data).toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

/** Перешифровать DEK новым мастер-ключом (данные не трогаем) */
export function rewrapDek(
  dek: EncryptedBlob,
  oldMaster: Buffer,
  newMaster: Buffer,
): EncryptedBlob {
  const plainDek = decryptWithKey(oldMaster, dek);
  return encryptWithKey(newMaster, plainDek);
}

export function assertNoPlaintextLeak(
  stored: { dataEnc: Uint8Array; dekEnc: Uint8Array },
  plaintextSecrets: string[],
): void {
  const hay = Buffer.concat([
    Buffer.from(stored.dataEnc),
    Buffer.from(stored.dekEnc),
  ]).toString("utf8");
  for (const s of plaintextSecrets) {
    if (!s || s.length < 4) continue;
    if (hay.includes(s)) {
      throw new Error("Утечка открытого текста в ciphertext");
    }
  }
}

export function buffersEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export { masterKeyFromEnv };
