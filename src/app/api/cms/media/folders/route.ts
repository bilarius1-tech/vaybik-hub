import { NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { prisma } from "@/server/db";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    await requireCan("content.manage");
    const folders = await prisma.mediaFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { assets: true, children: true } } },
    });
    return jsonOk({ folders });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const body = createSchema.parse(await req.json());
    if (body.parentId) {
      const parent = await prisma.mediaFolder.findUnique({
        where: { id: body.parentId },
      });
      if (!parent) return jsonError("NOT_FOUND", "Родитель не найден", 404);
      if (parent.parentId) {
        return jsonError(
          "VALIDATION",
          "Вложенность папок только 1 уровень",
          400,
        );
      }
    }
    const folder = await prisma.mediaFolder.create({
      data: {
        name: body.name,
        parentId: body.parentId || null,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    await writeAudit({
      actorId: auth.user.id,
      action: "cms.media.folder.create",
      entity: "MediaFolder",
      entityId: folder.id,
      diff: { name: folder.name },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ folder }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
