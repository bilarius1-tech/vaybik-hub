import { createHash } from "node:crypto";
import sharp from "sharp";
import { sanitizeSvgFile } from "../sanitize";
import type { MediaVariant } from "./url";

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_MAX_PIXELS = 40_000_000;

export type DetectedKind = "IMAGE" | "SVG" | "GIF";

export type ProcessResult = {
  kind: DetectedKind;
  mime: string;
  ext: string;
  width: number | null;
  height: number | null;
  sha256: string;
  variants: MediaVariant[];
  /** relative file name → buffer */
  files: Map<string, Buffer>;
};

function sha(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function sniff(buf: Buffer): { mime: string; kind: DetectedKind; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", kind: "IMAGE", ext: "jpg" };
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { mime: "image/png", kind: "IMAGE", ext: "png" };
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", kind: "IMAGE", ext: "webp" };
  }
  if (buf.length >= 6 && (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a")) {
    return { mime: "image/gif", kind: "GIF", ext: "gif" };
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 4, 8) === "ftyp"
  ) {
    // avif / heic-ish
    const brand = buf.toString("ascii", 8, 12);
    if (brand.startsWith("avi") || brand.includes("avif")) {
      return { mime: "image/avif", kind: "IMAGE", ext: "avif" };
    }
  }
  const head = buf.subarray(0, Math.min(256, buf.length)).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    return { mime: "image/svg+xml", kind: "SVG", ext: "svg" };
  }
  return null;
}

async function webpVariant(
  input: Buffer,
  width: number,
  name: string,
  files: Map<string, Buffer>,
  variants: MediaVariant[],
  srcW: number,
): Promise<void> {
  if (srcW < width && name !== "preview") {
    // не увеличиваем
    return;
  }
  const target = Math.min(width, srcW || width);
  const out = await sharp(input, { limitInputPixels: MEDIA_MAX_PIXELS })
    .rotate()
    .resize({ width: target, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const file = `${name}.webp`;
  files.set(file, out.data);
  variants.push({
    name,
    w: out.info.width,
    h: out.info.height,
    file,
    size: out.data.length,
    mime: "image/webp",
  });
}

export async function processMediaBuffer(
  buf: Buffer,
  originalName: string,
): Promise<ProcessResult> {
  if (buf.length > MEDIA_MAX_BYTES) {
    throw Object.assign(new Error("Файл больше 10 МБ"), {
      status: 400,
      code: "TOO_LARGE",
    });
  }
  const sniffed = sniff(buf);
  if (!sniffed) {
    throw Object.assign(new Error("Неподдерживаемый тип файла"), {
      status: 400,
      code: "MIME",
    });
  }

  const files = new Map<string, Buffer>();
  const variants: MediaVariant[] = [];
  const digest = sha(buf);

  if (sniffed.kind === "SVG") {
    const cleaned = sanitizeSvgFile(buf.toString("utf8"));
    const out = Buffer.from(cleaned, "utf8");
    const file = "orig.svg";
    files.set(file, out);
    let width: number | null = null;
    let height: number | null = null;
    const vb = cleaned.match(/viewBox=["']([^"']+)["']/i);
    if (vb) {
      const parts = vb[1].trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        width = Math.round(parts[2]);
        height = Math.round(parts[3]);
      }
    }
    variants.push({
      name: "orig",
      w: width,
      h: height,
      file,
      size: out.length,
      mime: "image/svg+xml",
    });
    return {
      kind: "SVG",
      mime: "image/svg+xml",
      ext: "svg",
      width,
      height,
      sha256: sha(out),
      variants,
      files,
    };
  }

  if (sniffed.kind === "GIF") {
    const file = "orig.gif";
    files.set(file, buf);
    const meta = await sharp(buf, {
      animated: true,
      limitInputPixels: MEDIA_MAX_PIXELS,
    }).metadata();
    variants.push({
      name: "orig",
      w: meta.width ?? null,
      h: meta.height ?? null,
      file,
      size: buf.length,
      mime: "image/gif",
    });
    // статичный превью — первый кадр
    const preview = await sharp(buf, { pages: 1, limitInputPixels: MEDIA_MAX_PIXELS })
      .rotate()
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    files.set("preview.webp", preview.data);
    variants.push({
      name: "preview",
      w: preview.info.width,
      h: preview.info.height,
      file: "preview.webp",
      size: preview.data.length,
      mime: "image/webp",
    });
    return {
      kind: "GIF",
      mime: "image/gif",
      ext: "gif",
      width: meta.width ?? null,
      height: meta.height ?? null,
      sha256: digest,
      variants,
      files,
    };
  }

  // IMAGE: strip EXIF via rotate() without withMetadata
  const meta = await sharp(buf, { limitInputPixels: MEDIA_MAX_PIXELS })
    .rotate()
    .metadata();
  const srcW = meta.width || 0;

  // оригинал без метаданных
  let origBuf: Buffer;
  let origMime = sniffed.mime;
  let origExt = sniffed.ext;
  if (sniffed.ext === "jpg" || sniffed.ext === "jpeg") {
    origBuf = await sharp(buf, { limitInputPixels: MEDIA_MAX_PIXELS })
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    origMime = "image/jpeg";
    origExt = "jpg";
  } else if (sniffed.ext === "png") {
    origBuf = await sharp(buf, { limitInputPixels: MEDIA_MAX_PIXELS })
      .rotate()
      .png({ compressionLevel: 9 })
      .toBuffer();
  } else if (sniffed.ext === "webp") {
    origBuf = await sharp(buf, { limitInputPixels: MEDIA_MAX_PIXELS })
      .rotate()
      .webp({ quality: 90 })
      .toBuffer();
  } else {
    // avif → сохранить как webp-оригинал для совместимости? prompt says variants webp + orig
    origBuf = await sharp(buf, { limitInputPixels: MEDIA_MAX_PIXELS })
      .rotate()
      .webp({ quality: 90 })
      .toBuffer();
    origMime = "image/webp";
    origExt = "webp";
  }

  const origFile = `orig.${origExt}`;
  files.set(origFile, origBuf);
  const origMeta = await sharp(origBuf).metadata();
  variants.push({
    name: "orig",
    w: origMeta.width ?? srcW,
    h: origMeta.height ?? meta.height ?? null,
    file: origFile,
    size: origBuf.length,
    mime: origMime,
  });

  const cleanInput = origBuf;
  const w = origMeta.width || srcW;
  const h = origMeta.height || meta.height || 0;
  await webpVariant(cleanInput, 480, "w480", files, variants, w);
  await webpVariant(cleanInput, 960, "w960", files, variants, w);
  await webpVariant(cleanInput, 1600, "w1600", files, variants, w);

  void originalName;
  return {
    kind: "IMAGE",
    mime: origMime,
    ext: origExt,
    width: w || null,
    height: h || null,
    sha256: sha(origBuf),
    variants,
    files,
  };
}
