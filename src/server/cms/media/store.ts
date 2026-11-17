import { mkdir, rm, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db";
import { uploadsRoot } from "@/server/uploads/store";
import {
  processMediaBuffer,
  type ProcessResult,
  MEDIA_MAX_BYTES,
} from "./process";
import { mediaSoftLimitBytes, mediaVariantUrl, type MediaVariant } from "./url";

export { MEDIA_MAX_BYTES };

export class MediaError extends Error {
  status: number;
  code: string;
  extra?: Record<string, unknown>;
  constructor(
    message: string,
    status = 400,
    code = "MEDIA",
    extra?: Record<string, unknown>,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** Сериализация обработки sharp — одна за раз */
let processChain: Promise<unknown> = Promise.resolve();

function enqueueProcess<T>(fn: () => Promise<T>): Promise<T> {
  const next = processChain.then(fn, fn);
  processChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function mediaRoot(): string {
  return path.join(uploadsRoot(), "media");
}

export function mediaVersionDir(id: string, version: number): string {
  return path.join(mediaRoot(), id, `v${version}`);
}

export async function writeMediaFiles(
  id: string,
  version: number,
  files: Map<string, Buffer>,
): Promise<void> {
  const dir = mediaVersionDir(id, version);
  await mkdir(dir, { recursive: true });
  for (const [name, buf] of files) {
    if (name.includes("..") || name.includes("/") || name.includes("\\")) {
      throw new MediaError("Некорректное имя варианта", 400, "BAD_NAME");
    }
    await writeFile(path.join(dir, name), buf);
  }
}

export async function removeMediaVersion(
  id: string,
  version: number,
): Promise<void> {
  const dir = mediaVersionDir(id, version);
  await rm(dir, { recursive: true, force: true });
}

export async function removeMediaAssetDir(id: string): Promise<void> {
  await rm(path.join(mediaRoot(), id), { recursive: true, force: true });
}

export type MediaAssetDto = {
  id: string;
  kind: string;
  folderId: string | null;
  tags: string[];
  originalName: string;
  title: string | null;
  alt: string | null;
  caption: string | null;
  mime: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  sha256: string;
  version: number;
  variants: MediaVariant[];
  urls: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  alreadyExists?: boolean;
};

function parseVariants(raw: unknown): MediaVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw as MediaVariant[];
}

export function toMediaDto(
  asset: {
    id: string;
    kind: string;
    folderId: string | null;
    tags: string[];
    originalName: string;
    title: string | null;
    alt: string | null;
    caption: string | null;
    mime: string;
    ext: string;
    size: number;
    width: number | null;
    height: number | null;
    sha256: string;
    version: number;
    variants: unknown;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  },
  extra?: { alreadyExists?: boolean },
): MediaAssetDto {
  const variants = parseVariants(asset.variants);
  const urls: Record<string, string> = {};
  for (const v of variants) {
    urls[v.name] = mediaVariantUrl(asset, v);
  }
  return {
    id: asset.id,
    kind: asset.kind,
    folderId: asset.folderId,
    tags: asset.tags,
    originalName: asset.originalName,
    title: asset.title,
    alt: asset.alt,
    caption: asset.caption,
    mime: asset.mime,
    ext: asset.ext,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    sha256: asset.sha256,
    version: asset.version,
    variants,
    urls,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    deletedAt: asset.deletedAt?.toISOString() ?? null,
    ...(extra?.alreadyExists ? { alreadyExists: true } : {}),
  };
}

export async function processAndCreateAsset(opts: {
  buf: Buffer;
  originalName: string;
  folderId?: string | null;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
  tags?: string[];
  uploadedById?: string | null;
}): Promise<MediaAssetDto> {
  const processed = await enqueueProcess(() =>
    processMediaBuffer(opts.buf, opts.originalName),
  );

  const existing = await prisma.mediaAsset.findUnique({
    where: { sha256: processed.sha256 },
  });
  if (existing && !existing.deletedAt) {
    return toMediaDto(existing, { alreadyExists: true });
  }
  if (existing && existing.deletedAt) {
    // восстановить из корзины с теми же файлами? проще создать новый version на том же id
    await writeMediaFiles(existing.id, existing.version + 1, processed.files);
    if (existing.version > 0) {
      await removeMediaVersion(existing.id, existing.version).catch(() => undefined);
    }
    const restored = await prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        kind: processed.kind,
        folderId: opts.folderId ?? existing.folderId,
        tags: opts.tags ?? existing.tags,
        originalName: opts.originalName,
        title: opts.title ?? existing.title,
        alt: opts.alt ?? existing.alt,
        caption: opts.caption ?? existing.caption,
        mime: processed.mime,
        ext: processed.ext,
        size: [...processed.files.values()].reduce((s, b) => s + b.length, 0),
        width: processed.width,
        height: processed.height,
        sha256: processed.sha256,
        version: existing.version + 1,
        variants: processed.variants,
        deletedAt: null,
        uploadedById: opts.uploadedById ?? existing.uploadedById,
      },
    });
    return toMediaDto(restored);
  }

  // создаём запись сначала с временным cuid через prisma, потом пишем файлы
  const size = [...processed.files.values()].reduce((s, b) => s + b.length, 0);
  const created = await prisma.mediaAsset.create({
    data: {
      kind: processed.kind,
      folderId: opts.folderId || null,
      tags: opts.tags || [],
      originalName: opts.originalName,
      title: opts.title || null,
      alt: opts.alt || null,
      caption: opts.caption || null,
      mime: processed.mime,
      ext: processed.ext,
      size,
      width: processed.width,
      height: processed.height,
      sha256: processed.sha256,
      version: 1,
      variants: processed.variants,
      uploadedById: opts.uploadedById || null,
    },
  });

  try {
    await writeMediaFiles(created.id, 1, processed.files);
  } catch (err) {
    await prisma.mediaAsset.delete({ where: { id: created.id } }).catch(() => undefined);
    throw err;
  }

  return toMediaDto(created);
}

export async function replaceMediaAsset(
  id: string,
  buf: Buffer,
  originalName: string,
): Promise<MediaAssetDto> {
  const current = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!current || current.deletedAt) {
    throw new MediaError("Медиа не найдено", 404, "NOT_FOUND");
  }

  const processed = await enqueueProcess(() =>
    processMediaBuffer(buf, originalName),
  );

  const conflict = await prisma.mediaAsset.findUnique({
    where: { sha256: processed.sha256 },
  });
  if (conflict && conflict.id !== id && !conflict.deletedAt) {
    throw new MediaError(
      "Такой файл уже есть в другом ассете",
      409,
      "SHA_CONFLICT",
      { existingId: conflict.id },
    );
  }

  const nextVersion = current.version + 1;
  await writeMediaFiles(id, nextVersion, processed.files);
  const size = [...processed.files.values()].reduce((s, b) => s + b.length, 0);

  const updated = await prisma.mediaAsset.update({
    where: { id },
    data: {
      kind: processed.kind,
      originalName,
      mime: processed.mime,
      ext: processed.ext,
      size,
      width: processed.width,
      height: processed.height,
      sha256: processed.sha256,
      version: nextVersion,
      variants: processed.variants,
    },
  });

  await removeMediaVersion(id, current.version).catch(() => undefined);
  return toMediaDto(updated);
}

export async function totalMediaBytes(): Promise<number> {
  const agg = await prisma.mediaAsset.aggregate({
    where: { deletedAt: null },
    _sum: { size: true },
  });
  return agg._sum.size || 0;
}

export async function mediaQuotaStatus(): Promise<{
  usedBytes: number;
  softLimitBytes: number;
  overSoftLimit: boolean;
}> {
  const usedBytes = await totalMediaBytes();
  const softLimitBytes = mediaSoftLimitBytes();
  return {
    usedBytes,
    softLimitBytes,
    overSoftLimit: usedBytes > softLimitBytes,
  };
}

/** Физический размер каталога media (для отчётов) */
export async function diskUsageMedia(): Promise<number> {
  const root = mediaRoot();
  async function walk(dir: string): Promise<number> {
    let total = 0;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) total += await walk(p);
      else {
        try {
          total += (await stat(p)).size;
        } catch {
          /* skip */
        }
      }
    }
    return total;
  }
  return walk(root);
}

export type { ProcessResult };
