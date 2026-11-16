import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
};

export class UploadError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "UPLOAD") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function uploadsRoot(): string {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  // Статический join, чтобы turbopack не трейсил весь проект
  return path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
}

export async function saveUpload(file: File): Promise<{
  filename: string;
  url: string;
  mime: string;
  size: number;
  sha256: string;
}> {
  const mime = file.type || "application/octet-stream";
  const ext = ALLOWED[mime];
  if (!ext) {
    throw new UploadError(
      `MIME не разрешён: ${mime}. Допустимы PNG/JPEG/WebP/SVG/ICO`,
      400,
      "MIME",
    );
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("Файл больше 2 МБ", 400, "TOO_LARGE");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const filename = `${randomBytes(12).toString("hex")}${ext}`;
  const root = uploadsRoot();
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, filename), buf);

  return {
    filename,
    url: `/admin/api/public/uploads/${filename}`,
    mime,
    size: buf.length,
    sha256,
  };
}

export function assertSafeUploadName(name: string): string {
  if (!/^[a-f0-9]{24}\.(png|jpg|webp|svg|ico)$/.test(name)) {
    throw new UploadError("Некорректное имя файла", 400, "BAD_NAME");
  }
  return name;
}
