import { readFile } from "node:fs/promises";
import path from "node:path";
import { handleRouteError, jsonError } from "@/server/http/response";
import { assertSafeUploadName, uploadsRoot } from "@/server/uploads/store";

type Ctx = { params: Promise<{ name: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { name } = await ctx.params;
    const safe = assertSafeUploadName(name);
    const filePath = path.join(uploadsRoot(), safe);
    const buf = await readFile(filePath);
    const ext = path.extname(safe);
    if (ext === ".svg") {
      return new Response(buf, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
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
