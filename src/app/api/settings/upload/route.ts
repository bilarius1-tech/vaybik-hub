import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { UploadError, saveUpload } from "@/server/uploads/store";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("VALIDATION", "Нужен файл в поле file", 400);
    }
    const saved = await saveUpload(file);
    await writeAudit({
      actorId: ctx.user.id,
      action: "settings.upload",
      entity: "Upload",
      entityId: saved.filename,
      diff: { mime: saved.mime, size: saved.size },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ file: saved }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) {
      return jsonError(err.code, err.message, err.status);
    }
    return handleRouteError(err);
  }
}
