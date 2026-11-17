import { readFile } from "node:fs/promises";
import path from "node:path";
import { handleRouteError, jsonError } from "@/server/http/response";
import { assertSafeMediaPath } from "@/server/cms/media/url";
import { mediaVersionDir } from "@/server/cms/media/store";

type Ctx = {
  params: Promise<{ id: string; version: string; file: string }>;
};

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

function svgHeaders(): HeadersInit {
  return {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id, version, file } = await ctx.params;
    const safe = assertSafeMediaPath(id, version, file);
    const filePath = path.join(
      mediaVersionDir(safe.id, safe.version),
      safe.file,
    );
    const buf = await readFile(filePath);
    const ext = path.extname(safe.file).toLowerCase();
    if (ext === ".svg") {
      return new Response(buf, { headers: svgHeaders() });
    }
    return new Response(buf, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      return jsonError("NOT_FOUND", "Файл не найден", 404);
    }
    return handleRouteError(err);
  }
}
