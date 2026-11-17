import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { prisma } from "@/server/db";
import {
  MediaError,
  mediaQuotaStatus,
  processAndCreateAsset,
  toMediaDto,
  MEDIA_MAX_BYTES,
} from "@/server/cms/media/store";

export async function GET(req: NextRequest) {
  try {
    await requireCan("content.manage");
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const folder = sp.get("folder");
    const kind = sp.get("kind");
    const trash = sp.get("trash") === "1";
    const page = Math.max(1, Number(sp.get("page") || "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") || "40") || 40));

    const where: Prisma.MediaAssetWhereInput = {
      deletedAt: trash ? { not: null } : null,
    };
    if (folder === "null" || folder === "root") {
      where.folderId = null;
    } else if (folder) {
      where.folderId = folder;
    }
    if (kind && ["IMAGE", "SVG", "GIF"].includes(kind)) {
      where.kind = kind as "IMAGE" | "SVG" | "GIF";
    }
    if (q) {
      where.OR = [
        { originalName: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { alt: { contains: q, mode: "insensitive" } },
        { caption: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
      ];
    }

    const [total, items, folders, quota] = await Promise.all([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.mediaFolder.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      mediaQuotaStatus(),
    ]);

    return jsonOk({
      items: items.map((a) => toMediaDto(a)),
      total,
      page,
      pageSize,
      folders,
      quota,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("content.manage");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("VALIDATION", "Нужен файл в поле file", 400);
    }
    if (file.size > MEDIA_MAX_BYTES) {
      return jsonError("TOO_LARGE", "Файл больше 10 МБ", 400);
    }
    const folderIdRaw = form.get("folderId");
    const folderId =
      typeof folderIdRaw === "string" && folderIdRaw ? folderIdRaw : null;
    const alt = typeof form.get("alt") === "string" ? String(form.get("alt")) : null;
    const title =
      typeof form.get("title") === "string" ? String(form.get("title")) : null;
    const caption =
      typeof form.get("caption") === "string"
        ? String(form.get("caption"))
        : null;

    const buf = Buffer.from(await file.arrayBuffer());
    const asset = await processAndCreateAsset({
      buf,
      originalName: file.name || "upload",
      folderId,
      alt,
      title,
      caption,
      uploadedById: ctx.user.id,
    });

    if (!asset.alreadyExists) {
      await writeAudit({
        actorId: ctx.user.id,
        action: "cms.media.upload",
        entity: "MediaAsset",
        entityId: asset.id,
        diff: {
          mime: asset.mime,
          size: asset.size,
          kind: asset.kind,
          originalName: asset.originalName,
        },
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
    }

    return jsonOk(
      { asset },
      { status: asset.alreadyExists ? 200 : 201 },
    );
  } catch (err) {
    if (err instanceof MediaError) {
      return jsonError(err.code, err.message, err.status, err.extra);
    }
    return handleRouteError(err);
  }
}
