import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertPathAvailable } from "@/server/cms/service";
import { pageCreateSchema } from "@/server/cms/schemas";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireCan("content.manage");
    const status = req.nextUrl.searchParams.get("status");
    const q = req.nextUrl.searchParams.get("q")?.trim();

    const pages = await prisma.page.findMany({
      where: {
        ...(status ? { status: status as "DRAFT" | "PUBLISHED" | "ARCHIVED" } : {}),
        ...(q
          ? {
              OR: [
                { path: { contains: q, mode: "insensitive" } },
                { title: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { path: "asc" }],
      include: {
        _count: { select: { blocks: true } },
      },
    });
    return jsonOk({ pages });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("content.manage");
    const body = pageCreateSchema.parse(await req.json());
    await assertPathAvailable(body.path);

    const page = await prisma.page.create({
      data: {
        path: body.path,
        title: body.title,
        template: body.template,
        status: body.status,
        sortOrder: body.sortOrder,
        updatedById: ctx.user.id,
        source: "manual",
      },
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: "cms.page.create",
      entity: "Page",
      entityId: page.id,
      diff: { path: page.path, title: page.title },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ page }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
