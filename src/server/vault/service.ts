import type { Secret } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  openVaultPayload,
  sealVaultPayload,
  type EncryptedBlob,
} from "@/server/vault/crypto";

export type SecretMeta = Omit<
  Secret,
  "dataEnc" | "dataIv" | "dataTag" | "dekEnc" | "dekIv" | "dekTag"
>;

export function toMeta(s: Secret): SecretMeta {
  return {
    id: s.id,
    title: s.title,
    kind: s.kind,
    url: s.url,
    username: s.username,
    folder: s.folder,
    tags: s.tags,
    note: s.note,
    keyVersion: s.keyVersion,
    createdById: s.createdById,
    updatedAt: s.updatedAt,
    createdAt: s.createdAt,
  };
}

/** Prisma Bytes + Node Buffer types diverge на ArrayBuffer vs ArrayBufferLike */
function asBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  return buf as unknown as Uint8Array<ArrayBuffer>;
}

function blob(
  ciphertext: Buffer,
  iv: Buffer,
  tag: Buffer,
): EncryptedBlob {
  return { ciphertext, iv, tag };
}

export async function createSecret(input: {
  title: string;
  kind: string;
  url?: string | null;
  username?: string | null;
  folder?: string | null;
  tags: string[];
  note?: string | null;
  secrets: Record<string, string | undefined>;
  createdById: string;
}) {
  const sealed = sealVaultPayload(
    Object.fromEntries(
      Object.entries(input.secrets).filter(([, v]) => v != null && v !== ""),
    ),
  );
  return prisma.secret.create({
    data: {
      title: input.title,
      kind: input.kind,
      url: input.url || null,
      username: input.username || null,
      folder: input.folder || null,
      tags: input.tags,
      note: input.note || null,
      dataEnc: asBytes(sealed.data.ciphertext),
      dataIv: asBytes(sealed.data.iv),
      dataTag: asBytes(sealed.data.tag),
      dekEnc: asBytes(sealed.dek.ciphertext),
      dekIv: asBytes(sealed.dek.iv),
      dekTag: asBytes(sealed.dek.tag),
      keyVersion: sealed.keyVersion,
      createdById: input.createdById,
    },
  });
}

export function revealSecretPayload(secret: Secret): Record<string, unknown> {
  return openVaultPayload(
    blob(Buffer.from(secret.dataEnc), Buffer.from(secret.dataIv), Buffer.from(secret.dataTag)),
    blob(Buffer.from(secret.dekEnc), Buffer.from(secret.dekIv), Buffer.from(secret.dekTag)),
  );
}

export async function updateSecretSecrets(
  id: string,
  secrets: Record<string, string | undefined>,
  meta?: Partial<{
    title: string;
    kind: string;
    url: string | null;
    username: string | null;
    folder: string | null;
    tags: string[];
    note: string | null;
  }>,
) {
  const sealed = sealVaultPayload(
    Object.fromEntries(
      Object.entries(secrets).filter(([, v]) => v != null && v !== ""),
    ),
  );
  return prisma.secret.update({
    where: { id },
    data: {
      ...meta,
      dataEnc: asBytes(sealed.data.ciphertext),
      dataIv: asBytes(sealed.data.iv),
      dataTag: asBytes(sealed.data.tag),
      dekEnc: asBytes(sealed.dek.ciphertext),
      dekIv: asBytes(sealed.dek.iv),
      dekTag: asBytes(sealed.dek.tag),
      keyVersion: sealed.keyVersion,
    },
  });
}

/** Ищет секрет telegram_bot и возвращает token; иначе env */
export async function resolveTelegramBotToken(): Promise<string | null> {
  const row = await prisma.secret.findFirst({
    where: { kind: "telegram_bot" },
    orderBy: { updatedAt: "desc" },
  });
  if (row) {
    try {
      const payload = revealSecretPayload(row);
      const token =
        (typeof payload.token === "string" && payload.token) ||
        (typeof payload.apiKey === "string" && payload.apiKey) ||
        null;
      if (token) return token;
    } catch (err) {
      console.warn("[vault] telegram_bot decrypt failed", err);
    }
  }
  return process.env.TELEGRAM_BOT_TOKEN || null;
}
