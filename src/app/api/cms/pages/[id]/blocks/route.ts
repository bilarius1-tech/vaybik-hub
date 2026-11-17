import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import {
  blockCreateSchema,
  blockUpdateSchema,
  blocksReorderSchema,
} from "@/server/cms/schemas";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { syncBlockMediaUsage } from "@/server/cms/media/sync-usage";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id: pageId } = await ctx.params;
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) return jsonError("NOT_FOUND", "Страница не найдена", 404);

    const body = blockCreateSchema.parse(await req.json());
    const max = await prisma.block.aggregate({
      where: { pageId },
      _max: { sortOrder: true },
    });
    const sortOrder = body.sortOrder ?? (max._max.sortOrder ?? -1) + 1;

    const block = await prisma.$transaction(async (tx) => {
      const created = await tx.block.create({
        data: {
          pageId,
          type: body.type,
          data: body.data as Prisma.InputJsonValue,
          isHidden: body.isHidden,
          anchor: body.anchor ?? null,
          sortOrder,
        },
      });
      await syncBlockMediaUsage(tx, {
        pageId,
        blockId: created.id,
        type: created.type,
        data: created.data,
      });
      await tx.page.update({
        where: { id: pageId },
        data: { updatedById: auth.user.id, source: "manual" },
      });
      return created;
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.block.create",
      entity: "Block",
      entityId: block.id,
      diff: { pageId, type: block.type, sortOrder: block.sortOrder },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ block }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id: pageId } = await ctx.params;
    const raw = await req.json();

    // Переупорядочивание: { ids: [...] }
    if (raw && typeof raw === "object" && "ids" in raw && !("blockId" in raw)) {
      const { ids } = blocksReorderSchema.parse(raw);
      const blocks = await prisma.block.findMany({ where: { pageId } });
      if (blocks.length !== ids.length || !ids.every((id) => blocks.some((b) => b.id === id))) {
        return jsonError("VALIDATION", "ids должны совпадать с блоками страницы");
      }
      await prisma.$transaction(
        ids.map((id, i) =>
          prisma.block.update({ where: { id }, data: { sortOrder: i } }),
        ),
      );
      await prisma.page.update({
        where: { id: pageId },
        data: { updatedById: auth.user.id, source: "manual" },
      });
      await writeAudit({
        actorId: auth.user.id,
        action: "cms.block.reorder",
        entity: "Page",
        entityId: pageId,
        diff: { ids },
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      const updated = await prisma.block.findMany({
        where: { pageId },
        orderBy: { sortOrder: "asc" },
      });
      return jsonOk({ blocks: updated });
    }

    // Обновление одного блока: { blockId, ...fields }
    const blockId = zBlockId(raw);
    const fields = blockUpdateSchema.parse(raw);
    const existing = await prisma.block.findFirst({
      where: { id: blockId, pageId },
    });
    if (!existing) return jsonError("NOT_FOUND", "Блок не найден", 404);

    // Конфликт оптимистичной блокировки (§5)
    if (
      fields.updatedAt &&
      existing.updatedAt.getTime() > new Date(fields.updatedAt).getTime()
    ) {
      return jsonError(
        "CONFLICT",
        "Изменено другим пользователем, обновить",
        409,
        { updatedAt: existing.updatedAt.toISOString() },
      );
    }

    const block = await prisma.$transaction(async (tx) => {
      const updated = await tx.block.update({
        where: { id: blockId },
        data: {
          ...(fields.type ? { type: fields.type } : {}),
          ...(fields.data !== undefined
            ? { data: fields.data as Prisma.InputJsonValue }
            : {}),
          ...(fields.isHidden !== undefined ? { isHidden: fields.isHidden } : {}),
          ...(fields.anchor !== undefined ? { anchor: fields.anchor } : {}),
          ...(fields.sortOrder !== undefined
            ? { sortOrder: fields.sortOrder }
            : {}),
        },
      });
      if (fields.data !== undefined || fields.type) {
        await syncBlockMediaUsage(tx, {
          pageId,
          blockId: updated.id,
          type: updated.type,
          data: updated.data,
        });
      }
      await tx.page.update({
        where: { id: pageId },
        data: { updatedById: auth.user.id, source: "manual" },
      });
      return updated;
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.block.update",
      entity: "Block",
      entityId: block.id,
      diff: { type: block.type, isHidden: block.isHidden },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ block });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const { id: pageId } = await ctx.params;
    const raw = await req.json();
    const blockId = zBlockId(raw);

    const existing = await prisma.block.findFirst({
      where: { id: blockId, pageId },
    });
    if (!existing) return jsonError("NOT_FOUND", "Блок не найден", 404);

    await prisma.block.delete({ where: { id: blockId } });
    await prisma.page.update({
      where: { id: pageId },
      data: { updatedById: auth.user.id, source: "manual" },
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.block.delete",
      entity: "Block",
      entityId: blockId,
      diff: { pageId, type: existing.type },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

function zBlockId(raw: unknown): string {
  if (!raw || typeof raw !== "object" || !("blockId" in raw)) {
    throw Object.assign(new Error("нужен blockId"), {
      status: 400,
      code: "VALIDATION",
    });
  }
  const id = (raw as { blockId: unknown }).blockId;
  if (typeof id !== "string" || !id) {
    throw Object.assign(new Error("некорректный blockId"), {
      status: 400,
      code: "VALIDATION",
    });
  }
  return id;
}
