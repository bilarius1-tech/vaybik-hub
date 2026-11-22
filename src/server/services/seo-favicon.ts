import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { uploadsRoot } from "@/server/uploads/store";

export const FAVICON_FILES = [
  "favicon.ico",
  "favicon-32.png",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "site.webmanifest",
] as const;

export type FaviconFile = (typeof FAVICON_FILES)[number];

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

export function serviceSeoDir(serviceId: string): string {
  return path.join(uploadsRoot(), "service-seo", serviceId);
}

/** PNG → простой ICO (PNG-payload, современные браузеры). */
export function pngToIco(png: Buffer): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  // 0 = 256; для 32px пишем 32
  const meta = sharp(png).metadata();
  void meta;
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

async function resizePng(input: Buffer, size: number): Promise<Buffer> {
  return sharp(input, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();
}

export async function generateServiceFavicons(opts: {
  serviceId: string;
  source: Buffer;
  mime: string;
  name: string;
  shortName?: string;
}): Promise<{
  sourceFile: string;
  sourceMime: string;
  files: FaviconFile[];
}> {
  if (opts.source.length > MAX_BYTES) {
    throw new Error("Favicon слишком большой (макс. 2 МБ)");
  }
  const mime = opts.mime || "application/octet-stream";
  const isSvg =
    mime.includes("svg") ||
    opts.source
      .subarray(0, 256)
      .toString("utf8")
      .trimStart()
      .startsWith("<svg") ||
    opts.source
      .subarray(0, 256)
      .toString("utf8")
      .trimStart()
      .startsWith("<?xml");
  const isPng =
    mime === "image/png" ||
    (opts.source[0] === 0x89 &&
      opts.source[1] === 0x50 &&
      opts.source[2] === 0x4e &&
      opts.source[3] === 0x47);
  const isJpeg =
    mime === "image/jpeg" ||
    (opts.source[0] === 0xff &&
      opts.source[1] === 0xd8 &&
      opts.source[2] === 0xff);
  const isWebp =
    mime === "image/webp" ||
    (opts.source.toString("ascii", 0, 4) === "RIFF" &&
      opts.source.toString("ascii", 8, 12) === "WEBP");

  if (!isSvg && !isPng && !isJpeg && !isWebp) {
    throw new Error("Нужен SVG, PNG, JPEG или WebP");
  }

  const dir = serviceSeoDir(opts.serviceId);
  await mkdir(dir, { recursive: true });

  const sourceExt = isSvg ? "svg" : isPng ? "png" : isJpeg ? "jpg" : "webp";
  const sourceFile = `source.${sourceExt}`;
  const sourceMime = isSvg
    ? "image/svg+xml"
    : isPng
      ? "image/png"
      : isJpeg
        ? "image/jpeg"
        : "image/webp";
  await writeFile(path.join(dir, sourceFile), opts.source);

  // SVG → растеризуем через sharp (librsvg/libvips)
  const rasterIn = isSvg
    ? await sharp(opts.source, { limitInputPixels: MAX_PIXELS, density: 300 })
        .png()
        .toBuffer()
    : opts.source;

  const png32 = await resizePng(rasterIn, 32);
  const png180 = await resizePng(rasterIn, 180);
  const png192 = await resizePng(rasterIn, 192);
  const png512 = await resizePng(rasterIn, 512);
  const ico = pngToIco(png32);

  await writeFile(path.join(dir, "favicon-32.png"), png32);
  await writeFile(path.join(dir, "apple-touch-icon.png"), png180);
  await writeFile(path.join(dir, "icon-192.png"), png192);
  await writeFile(path.join(dir, "icon-512.png"), png512);
  await writeFile(path.join(dir, "favicon.ico"), ico);

  const short = (opts.shortName || opts.name).slice(0, 12);
  const manifest = {
    name: opts.name,
    short_name: short,
    icons: [
      {
        src: "icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    theme_color: "#07051a",
    background_color: "#07051a",
    display: "standalone",
  };
  await writeFile(
    path.join(dir, "site.webmanifest"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return {
    sourceFile,
    sourceMime,
    files: [...FAVICON_FILES],
  };
}

export async function readServiceFaviconFile(
  serviceId: string,
  file: string,
): Promise<{ buf: Buffer; contentType: string } | null> {
  if (file.includes("..") || file.includes("/") || file.includes("\\")) {
    return null;
  }
  const allowed =
    (FAVICON_FILES as readonly string[]).includes(file) ||
    /^source\.(svg|png|jpg|webp)$/.test(file);
  if (!allowed) return null;
  try {
    const buf = await readFile(path.join(serviceSeoDir(serviceId), file));
    const contentType =
      file.endsWith(".ico")
        ? "image/x-icon"
        : file.endsWith(".png")
          ? "image/png"
          : file.endsWith(".svg")
            ? "image/svg+xml"
            : file.endsWith(".webmanifest")
              ? "application/manifest+json"
              : file.endsWith(".jpg")
                ? "image/jpeg"
                : file.endsWith(".webp")
                  ? "image/webp"
                  : "application/octet-stream";
    return { buf, contentType };
  } catch {
    return null;
  }
}
